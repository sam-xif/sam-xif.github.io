---
title: "ruby-lean Technical Appendix"
date: 2026-09-20
description: "Appendix of technical notes from the ruby-lean project"
category: blog
topic: tech
---

In the [original post](2026-09-20-ruby-lean.html), I introduced `ruby-lean`, an
executable semantics of Ruby in Lean, with an associated type system and type
soundness proof. This post is the technical appendix that offers a deeper view
into how the semantics, type system, and soundness result are modeled and
operationalized.

The content here assumes a familiarity with formal semantics, type theory, and
the notation with which these results are typically presented in academic papers
in the field.

## The system

A live demo [playground](/ruby-lean) is available. I encourage you to go play
with it :).

<img src="/blog_assets/type_pipeline.png" />

The above screenshot is from the playground. It showcases the five stages of how
this system determines the safety of a program:

1. Run Sorbet on a program with specific flags, so that Sorbet emits annotation
   information
1. Strip the program's annotations, since Sorbet annotations are real syntax
   that's outside of the modeled fragment
1. Desugar[]^(In the "syntactic sugar" sense. Most programming languages can be projected to simpler subsets of themselves. I don't go into much depth in this particular post for brevity, but this s-expression is roughly what the *desugaring* step does. The notion of "desugaring" was introduced by Krishnamurthi, Lerner, and Elberty in <a href="https://par.nsf.gov/servlets/purl/10124984"><i>The Next 700 Semantics: A Research Challenge</i></a>) the program, producing an s-expression that builds programs
   from a core set of Ruby primitives
1. Run an *untrusted* certificate emitter (a companion program written in Ruby)
   that proposes type judgements for the program
1. Run the *trusted* validator--`validateD p d` in `ruby-lean`'s code--that
   validates the derivation against the program and whether it implies safety,
   and returns true if so.

## A stroll through the semantics

Here I'll introduce the semantics very briefly. Also, reminder that you can view
the Lean code on [GitHub](https://github.com/sam-xif/ruby-lean)!

We built the Ruby semantics in Lean as an abstract CESK machine.[]^(The CESK machine was originally introduced by Felleisen in his <a href="https://www2.ccs.neu.edu/racket/pubs/dissertation-felleisen.pdf">doctoral thesis</a>) By
virtue of Lean's dual capability as a fully feature programming language and a
proof assistant, actual Ruby code can be executed within the `ruby-lean`. See it
in action on the [playground](/ruby-lean)!

CESK stands for *control*, *environment*, *store*, and *k(c)ontinuation*. These
all live in `ruby-lean`'s `Machine` structure.

```lean
structure Machine where
  ctl         : Ctl                     -- what to do next
  kont        : List Kont := []         -- the continuation stack
  stack       : List FrameId            -- active frames, innermost first
  frames      : Array Frame             -- the frame store
  heap        : Heap
  globals     : List (String × Value) := []
  out         : String := ""            -- accumulated stdout
  currentExc  : Option Value := none    -- Ruby's `$!`
  preludeMode : Bool := false
```

The *control* can be thought of as a virtual register that holds the next thing
the machine is going to do.

$$
\text{Ctl} ::= \text{eval}\,e \mid \text{value}\,v \mid \text{jump}\,j
$$

The set of values $v$ consists of references to objects in the heap and
primitives.

$$
v ::= \text{ref}\,o \mid \text{int}\,n \mid \text{flt}\,x \mid \text{sym}\,s \mid \text{bool}\,b \mid \text{nil}
$$

The *environment*, in our case, is a stack of `FrameId`s, plus information about
globals.

The *store* is represented as the `Heap`.

```lean
structure Heap where
  objs : Array Object
deriving Inhabited
```

This heap is an array that only grows. Finding the next object ID that is
unallocated is as simple as getting the size of the current heap: $|h|$. Let
the $::$ syntax denote concatenation of arrays (in this case, of objects). A
heap may be written in its destructured array form when appropriate: $[o_1, o_2, \cdots]$.

And finally, the *continuation* is represented as `kont`, a stack of
continuations.[]^(for the reader who may be unfamiliar, a *continuation* 
is a representation of what comes next in a program.)

We write configurations in this abstract machine $\langle c \mid K \mid S \mid F \mid h \rangle$ for the `ctl`, `kont`,
`stack`, `frames` and `heap` fields. In the following are reduction rules for
this semantics. Above of the line are written the antecedents, or premises, and
below each line is the consequent.

The following are three simple reduction rules. The first, E-Int, states that
for an integer $n$, we evaluate an integer value. E-Var is the rule for
evaluating an expression of a single variable by looking it up in the
environment. E-Str represents the allocation of a string literal onto the heap.
It reads "given a fresh object ID $o$, and the new heap after allocating
this object of class `String` with the value $\text{str} s$ as its data, we evaluate
the expression `"s"` to be the reference to the $o$th heap slot."

$$
\dfrac{}{\langle \text{eval}\ n \mid K \rangle \longrightarrow \langle \text{value}\ (\text{int}\ n) \mid K \rangle}\ \text{(E-Int)}
$$

$$
\dfrac{\text{getLocal}(S, F, x) = v}{\langle \text{eval}\ x \mid K \rangle \longrightarrow \langle \text{value}\ v \mid K \rangle}\ \text{(E-Var)}
$$

$$
\dfrac{o = |h| \quad h' = h :: [\lbrace \text{klass} = \text{String},\ \text{payload} = \text{str}\ s \rbrace]}{\langle \text{eval}\ \texttt{"}s\texttt{"} \mid K \mid h \rangle \longrightarrow \langle \text{value}\ (\text{ref}\ o) \mid K \mid h' \rangle}\ \text{(E-Str)}
$$

Now, let's look at an example of a more complex expression, assignments to
variables. E-Asgn and K-Asgn represent the two "steps" in assigning to a
variable in this machine. First, E-Asgn pushes an assignment (`asgnK`)
continuation onto the kont stack, and leaves behind an instruction to evaluate
the expression $e$. The machine then proceeds to evaluate this expression.
Finally, K-Asgn pops the `asgnK` continuation, consumes the computed value
$v$, and sets the variable $x$ in the current frame.

$$
\dfrac{}{\langle \text{eval}\ (x = e) \mid K \rangle \longrightarrow \langle \text{eval}\ e \mid \text{asgnK}\ x :: K \rangle}\ \text{(E-Asgn)}
$$

$$
\dfrac{F' = \text{setLocal}(S, F, x, v)}{\langle \text{value}\ v \mid \text{asgnK}\ x :: K \mid F \rangle \longrightarrow \langle \text{value}\ v \mid K \mid F' \rangle}\ \text{(K-Asgn)}
$$

Now, let's take a brief look at one of the most complex concerts of rules, those
for calling a method. In Ruby, this is referred to as a *send*. Everything in
Ruby is an object, and method invocations are modelled as messages that are sent
between objects. Ruby even has a `responds_to?` builtin that tests whether an
object "responds to" a certain message (a method name). Even what appears to be
an assignment to an instance variable, `a.x = 5`, gets written roughly as
`(send a "x=" (intLit 5))` in the desugared intermediate syntax.

A send is discharged by five rules that compose with each other. E-Send is the
rule that reads the initial messages end expression and initiates the send by
pushing a `recvK` continuation that captures the method/message name and the
sequence of argument expressions $\bar{a}$ onto the kont stack.

$$
\dfrac{}{\langle \text{eval}\ r.m(\bar{a}) \mid K \rangle \longrightarrow \langle \text{eval}\ r \mid \text{recvK}\ m\ \bar{a} :: K \rangle}\ \text{(E-Send)}
$$

Arguments are then evaluated in left-to-right order by K-Recv and repeated
application of K-Args, populating the sequence of argument *values* $\bar{w}$.

$$
\dfrac{}{\langle \text{value}\ v \mid \text{recvK}\ m\ (a :: \bar{a}) :: K \rangle \longrightarrow \langle \text{eval}\ a \mid \text{argsK}\ v\ m\ [\,]\ \bar{a} :: K \rangle}\ \text{(K-Recv)}
$$

$$
\dfrac{}{\langle \text{value}\ v \mid \text{argsK}\ r\ m\ \bar{w}\ (a :: \bar{a}) :: K \rangle \longrightarrow \langle \text{eval}\ a \mid \text{argsK}\ r\ m\ (\bar{w} :: [v])\ \bar{a} :: K \rangle}\ \text{(K-Args)}
$$

K-Call is what reduces to the method's body, putting $\text{eval}\ md.body$ in the control
position, and finally, K-Frame finishes the invocation by popping the method's
frame off the stack.

$$
\dfrac{
\begin{array}{c}
\text{lookup}(h, r, m) = \mathit{md} \qquad \mathit{md}.\mathit{params} = \overline{\text{req}\,x_i} \qquad |\bar{w} :: [v]| = |\bar{x}| \\
\mathit{fid} = |F| \qquad \mathit{fr} = \lbrace \text{self} = r,\ \text{locals} = \bar{x} \mapsto \bar{w} :: [v],\ \text{defmod} = \mathit{md}.\mathit{owner},\ \text{kind} = \text{method} \rbrace
\end{array}
}{\langle \text{value}\ v \mid \text{argsK}\ r\ m\ \bar{w}\ [\,] :: K \mid S \mid F \rangle \longrightarrow \langle \text{eval}\ \mathit{md}.\mathit{body} \mid \text{frameK}\ \mathit{fid} :: K \mid \mathit{fid} :: S \mid F :: [\mathit{fr}] \rangle}\ \text{(K-Call)}
$$

$$
\dfrac{}{\langle \text{value}\ v \mid \text{frameK}\ \mathit{fid} :: K \mid \mathit{fid} :: S \rangle \longrightarrow \langle \text{value}\ v \mid K \mid S \rangle}\ \text{(K-Frame)}
$$

All of these steps live as branches of the `stepFn` function in the codebase.

## The type system

Now that we have a semantics, what can we do with it?

Ultimately, these semantics should provide the foundation for formal safety
proofs about programs. So, we need to make sure that this semantics, grown with
AI in the way that it was, is amenable to such proofs.

What is the definition of safety, though? There are many such definitions, but
they all follow the schema "this program will not do this bad thing." In
practice, Ruby developers might use a type checker like Sorbet to gain
confidence in the safety "theorem" *if the type checker passes, my code will not
throw type errors*. Now that we have a semantics, we can uplevel this into a
formal statement.

First, we define a type system for Ruby. We have the standard literal types,
corresponding to primitive values. Class types are defined nominally by their
tags, which is the standard construction in static type systems hitched onto
dynamic languages. [Sorbet](https://sorbet.org/docs/class-types) and
[mypy](https://mypy.readthedocs.io/en/stable/protocols.html) both encode nominal
notions of class typing.

Semantically, this becomes tricky, because both languages support
metaprogramming that can change the bodies of classes and their instances after
their definition. For more details on how this is handled, I encourage you to
refer to the forthcoming technical report, and/or the
[source code](https://github.com/sam-xif/ruby-lean).

$$
\begin{array}{rcll}
\tau & ::= & \text{int} & \text{immediates} \\
 & \mid & \text{bool} &  \\
 & \mid & \text{nil} &  \\
 & \mid & \text{sym} &  \\
 & \mid & \text{float} &  \\
 & \mid & \text{cls}\,n & \text{an instance of class } n \\
 & \mid & \text{clsOf}\,n & \text{the class object } n \\
 & \mid & \text{any} & \text{top (never inferred)} \\
 & \mid & \text{never} & \text{bottom} \\
 & \mid & \text{nilable}\,\tau & \tau \text{ or nil} \\
 & \mid & \sigma \cup \tau & \text{union} \\
 & \mid & \text{arrayOf}\,\tau & \text{invariant collections} \\
 & \mid & \text{hashOf}\,\sigma\,\tau &  \\
 & \mid & \text{inst}\,n\,I & \text{an instance of user class } n \text{ with ivar spine } I \\
 & \mid & \iota_0 & \text{binding spines} \\
 & \mid & \iota(x{:}\tau, I) &  \\
 & \mid & \text{arrow}_0\,\tau & \text{callable spine} \\
 & \mid & \text{arrow}(\sigma, \tau) &  \\
 & \mid & \text{clos}(i, C, S) & \text{a block value} \\
 & \mid & \text{sameAs}(x, \tau) & \text{an alias fact}
\end{array}
$$

In the agents' autoformalization efforts, the peculiar notion of "binding
spines" $\iota$ emerged. This is a somewhat odd construction because it
overloads the typing definition with an additional piece of state about what's
true of the current `self`. In the future, I may consider separating this out.
Also defined are arrow types, which represent callables, and a closure type,
which are defined by $i$, the index into the global list of closures,
stored in the machine state, $C$, the captured binding spine (an instance
of the $\iota$ just described), and S, the type of `self` in the captured
environment.

<!-- 
#### Subtyping

Subtyping is defined, but it currently is not used anywhere in the judgements.
In future work, I plan on supporting judgements involving subtyping.

$$
\sigma <: \tau \iff
\sigma = \text{never} \ \vee\ \tau = \text{any} \ \vee\ (\tau = \text{nilable}\,\tau' \wedge (\sigma = \text{nil} \vee \sigma = \tau \vee \sigma <: \tau')) \ \vee\ \sigma = \tau
$$ -->

Syntax in the language is typed through *judgements*. A judgement in our type
system has the form

$$
\kappa;\ I;\ \Gamma \ \vdash\ e : \tau \ \dashv\ \kappa';\ I';\ \Gamma'
$$

- $\Gamma$: the local environment (a list of $x : \tau$).
- $\kappa$: the context — declared classes and their methods, top-level
  definitions, constants, the current `self` type, the enclosing frame, positive
  facts about the boot world, and negative facts (names guaranteed *not* to be
  defined).
- $I$: the ivar spine of the current `self`.

Where a rule threads a component unchanged, it is elided: $\Gamma \vdash e : \tau \dashv \Gamma'$.

We also have a set of "companion" judgements (AI's term, not mine), overloading
$\vdash$ on the shape of the subject syntax term:

$$
\begin{array}{ll}
\Gamma \vdash \bar{e} : \bar{\tau} \dashv \Gamma' & \text{argument lists and array elements} \\
\Gamma \vdash_{\text{seq}} \bar{e} : \tau \dashv \Gamma' & \text{statement sequences} \\
\Gamma \vdash_s e : \tau \dashv \Gamma' & \text{relative to a recursion scope } s \\
\kappa;\ I;\ \Gamma \vdash_{\text{init}} e : \tau \dashv \kappa';\ I';\ \Gamma' & \text{class initializer bodies}
\end{array}
$$

As before, an overbar marks a finite sequence: $\bar{a}$ is an argument list,
$\bar\tau$ the corresponding sequence of argument types, $\bar{p}$ a declared
parameter list.

Now, let's examine some illustrative judgements. As a reminder, in the
semantics, rules are defined over machine states. Here, typing is defined over
the syntax of the language. We relate the two in the proof of the soundness
theorem, covered in the following section.

First is the judgement of assignment expressions, Asgn. Intuitively, we have
$\Gamma \vdash e : \tau \dashv \Gamma'$ in the premise, which is the judgement of the right-hand side's type.

$$
\dfrac{
\begin{array}{c}
\Gamma \vdash e : \tau \dashv \Gamma' \qquad \text{capStale}(x,\tau,\tau) = \text{false} \\
\neg\,\text{isAlias}(\tau) \qquad \text{capStaleCtx}(x,\tau,\kappa') = \text{false}
\end{array}
}{\Gamma \vdash (x = e) : \tau \dashv \text{envAfter}(\Gamma', x, \tau)}\ \text{(Asgn)}
$$

Note that there are three side conditions, `capStale`, `capStaleCtx`, and
$\neg$ `isAlias`. These are not totally relevant to the current limited
system of judgements--these grew from the learnings of previous agents' attempts
at formalizing even larger portions of the type system. However, they still
serve as useful ways of taming the unsoundness of Ruby. `capStale`, for
instance, sprung out of an agent's attempt to prove safety of the family of
programs like

```ruby
x = 1
x = lambda { x } 
x.call + 1  # NoMethodError, on CRuby and ruby-lean
```

`capStale` returns true for `x` on the second line because `x` is captured in
the lambda body, but Ruby captures *by reference*. So, when the body of the
lambda is evaluated on line three, x evaluates to `lambda { x }`. Trying to add
this to 1 results in a error due to the type mismatch.

So, `capStale` (and related `capStaleCtx`) can therefore be thought of as
predicates about whether x is safe to assign to this new type $\tau$.
`isAlias` is similar, but its existence has to do purely with the the way we
desugar surface Ruby programs into a smaller core.

Sorbet implements an even stricter notion of whether an assignment is valid:
assignments can only walk along the subtyping relation in Ruby. The above
program would fail Sorbet because `lambda { x } <: int` is false. In typical
Ruby, however, does not restrict the reassignment of a variable to a different
value, so our type system tries to strike a middle ground. As a consequence,
**our type system is *more complete* than Sorbet while still maintaining
provable soundness.**

The If rule, given below, is much simpler. We type an if expression as the union
of the types of the two branches.

$$
\dfrac{
\Gamma \vdash c : \sigma \dashv \Gamma_c \qquad
\Gamma_c \vdash t : \tau_1 \dashv \Gamma_1 \qquad
\Gamma_c \vdash e : \tau_2 \dashv \Gamma_2
}{\Gamma \vdash (\texttt{if}\ c\ \texttt{then}\ t\ \texttt{else}\ e) : \tau_1 \sqcup \tau_2 \dashv \Gamma_1 \sqcup_{\Gamma} \Gamma_2}\ \text{(If)}
$$

The Prim rule is how builtin methods get typed. DPrim is an inductive relation
that axiomatizes the signatures of various builtin methods. The semantics source
code defines ~300 builtin methods, but the type system currently only covers a
subset. Notice the side condition, $\sigma = \text{cls}\,\texttt{String} \Rightarrow \text{isANoOk}(\dots)$. This is needed because Ruby
supports *class reopening*. String is a builtin class, but the following is a
valid program that executes in both CRuby and the `ruby-lean`:

```ruby
class String
  def speak()
    "hello world!"
  end
end

"s".speak  # evals to "hello world" on CRuby and Ruby-Lean
```

As the type system grows, mode side conditions will likely be needed to account
for other builtin classes.

$$
\dfrac{
\begin{array}{c}
\Gamma \vdash r : \sigma \dashv \Gamma_1 \qquad
\Gamma_1 \vdash \bar{a} : \bar{\tau} \dashv \Gamma_2 \qquad
\text{DPrim}\ \sigma\ m\ \bar\tau\ \tau \\
\text{nameFree}(\kappa_2, m) \qquad
\sigma = \text{cls}\,\texttt{String} \Rightarrow \text{isANoOk}(\dots)
\end{array}
}{\Gamma \vdash r.m(\bar a) : \tau \dashv \Gamma_2}\ \text{(Prim)}
$$

Finally, we present the rule for calling a method that has an assumed signature.
When attempting to validate a program, we take in an untrusted type derivation
(a JSON file) that posits types for certain variables and methods. These
signatures populate the context, $\kappa$.

$$
\dfrac{
\begin{array}{c}
\mathit{decl} \in \kappa'.\mathit{defs} \qquad
\mathit{decl}.\mathit{params} = \overline{\text{req}\,p_i} \\
\bar{p} \vdash \mathit{decl}.\mathit{body} : \tau \dashv \Gamma_b \qquad
\Gamma \vdash \bar{a} : \overline{p.\tau} \dashv \Gamma'
\end{array}
}{\Gamma \vdash \mathit{decl}.\mathit{name}(\bar a) : \tau \dashv \Gamma'}\ \text{(CallSig)}
$$

The side condition $\mathit{decl} \in \kappa'.\mathit{defs}$ ensures that the definition exists in the context
at the moment of dispatch. $\kappa'$ is the dispatch context because it is the
context that is left after all of the arguments are evaluated, which is what the
$\Gamma \vdash \bar{a} : \overline{p.\tau} \dashv \Gamma'$ antecedent specifies.

If $\kappa';\ I';\ \Gamma'$ is the dispatch context, you[]^(I wrote this sentence because <i>I</i> was wondering...lol) may be wondering then why
the $\bar{p} \vdash \mathit{decl}.\mathit{body} : \tau \dashv \Gamma_b$ antecedent doesn't read $\Gamma';\ \bar{p} \vdash \cdots$. Coming from another language
like Python, one might expect that a Ruby program like

```ruby
y = 5
def x
  y
end
x
```

would be reasonable. It turns out that *this is a type error*. Ruby attempts to
call y on the current `self`, which is the top-level object in which the program
is running, and `y` is not a method on `self`! Contrast this with Python, where

```python
y = 5
def x():
  return y
x()
```

executes just fine. When agents have a verifiable task, they get things right!

Now that your eyes have glazed over from all this fancy LaTeX, let's tie both
threads together into a soundness theorem.

## The soundness theorem

Type soundness basically means "typed programs can't go wrong." This requires a
definition of "wrong."

In `ruby-lean` so far, we define "wrong" as the type error family that accepted
programs are provably free of, as shown below.

```lean
def typeErrorFamily : List ObjId :=
  [Boot.noMethodErrorId, Boot.argumentErrorId, Boot.typeErrorId]

def isTypeError (h : Heap) (exc : Value) : Bool :=
  typeErrorFamily.any (isA h exc)

def typeStuck : Interp.RunResult → Bool
  | .uncaught exc m => isTypeError m.heap exc
  | _ => false
```

This set can and should be expanded in the future. I find this construction
elegant because this demonstrates how the safety property proven about a program
can be customized.

Let's now build up the metatheory needed to reason about program safety under
these semantics.

### Definitions

We have devised a system of syntactic judgements, but now we need to link them
back to the semantics. This first requires a semantic denotation of types. In
other words, an answer to the question "what does a type mean?" The denotation
is given here (and in the code) by `denM`:

$$
\text{denM} : \text{Ty} \to \text{Machine} \to \text{Value} \to \text{Prop}
$$

`denM` can be thought of as a relation between (machine, value) combinations and
types, where the relation holds if and only if that (machine, value) combination
is a semantic inhabitant of the type. Some selected semantic denotations are
given below.

With $h = m.\mathit{heap}$,

$$
\begin{array}{rcl}
\text{denM}(\text{int}, m, v) & = & \text{isInt}(v) \\
\text{denM}(\text{cls}\,n, m, v) & = & \text{isAName}(h, v, n) \\
\text{denM}(\text{arrayOf}\,\tau, m, v) & = & \exists \bar{x}.\ \text{arrElems}(h,v) = \bar{x} \wedge \forall x \in \bar{x}.\ \text{denM}(\tau,m,x) \\
\text{denM}(\text{inst}\,n\,I, m, v) & = & \text{isExactInst}(h,v,n) \wedge \text{denSpine}(I, m, \text{ivarOf}(h,v)) \\
\text{denM}(\text{never}, m, v) & = & \text{False} \\
\text{denM}(\text{any}, m, v) & = & \text{True} \\
\text{denM}(\text{arrow}_0\,\rho, m, f) & = & \text{isProc}(h,f) \wedge \forall m_2 \sqsupseteq m,\ v,\ m'.\ \text{Returns}(m_2,f,[\,],v,m') \Rightarrow \text{denM}(\rho,m',v)
\end{array}
$$

**Conformance** between a machine state and a typing context is defined by
$\text{StateOk}\ \kappa\ \Gamma\ I\ m$, which is a structure with 41 fields, too large to include here. Even
I frankly have not grokked this yet. It asserts facts like "this class is
actually defined in the heap" and "no other methods except the ones specified in
the context are defined on this class."

**Answers** represent a notion of how an execution can respond, similar in
spirit to a result type in Rust. An execution can either deliver a value, or
some exceptional state.

```lean
inductive Answer where | val (v : Value) | esc (j : Jump)

def EscOk (m₀ : Machine) : Jump → Prop
  | .raiseJ exc => Semantics.isTypeError m₀.heap exc = false
  | .retJ _ _   => False
  | .throwJ _ _ => False
  | _           => True

def AnsOk (τ : Ty) (m₀ : Machine) : Answer → Prop
  | .val v => denM τ m₀ v
  | .esc j => EscOk m₀ j
```

`AnsOk` reads "if the answer is a value, then it is typed according to $\tau$
in machine $m_0$, or if it is an escape, then it is not a raise of an error
in the `typeStuck` set." This is important for definitions below.

<!-- **Extension.** $\text{Ext}\ m\ m'$ holds when the frame array and frame stack are
unchanged, the heap only grows, every old object id reads back identically,
nothing became or stopped being a class, and the ancestor walk is unmoved.

**Framing.** $\text{Framed}\ m\ m'$ is a six-field structure: the frame stack is unchanged;
every class stays a class; nominal types are preserved ($\text{isAName}$ is monotone);
every first-order type is preserved; inactive caller frames are preserved when
the activation has no captured parent ($\text{FramePres}$); and saved receivers retain
their field types ($\text{FieldsPres}$). -->

<!-- 
$$
\forall \tau.\ \text{FirstOrder}(\tau) \Rightarrow \forall v.\ \text{denM}(\tau,m,v) \Rightarrow \text{denM}(\tau,m',v)
$$ -->

### Run spec

The *run spec* defines what a safe run of a program means.

$$
\begin{array}{rcl}
\text{RunSpec}(m_{\text{orig}}, m_{\text{start}}, \Gamma, \tau, \kappa, I) & = & \text{SafeA}(m_{\text{start}}) \\
 & & {} \wedge \forall \mathit{fuel}\,a\,m\,\mathit{rest}.\ \text{runA}\ \mathit{fuel}\ m_{\text{start}} = \text{ans}\,a\,m\,\mathit{rest} \\
 & & \qquad \Rightarrow \text{ResultOk}(m_{\text{orig}}, \Gamma, \tau, a, m, \kappa, I)
\end{array}
$$

This depends on a few definitions. First, `SafeA` reads "for all possible fuel
values, running the program from the given machine state will not result in
type-stuckness." `runA` is a helper that runs a program to the next available
answer (or out of fuel if that comes first). `ResultOk` depends on the `AnsOk`
and `StateOk` definitions given previously, and states that the result from this
slice of computation is a safe answer, and if that answer is a value, then state
conformance is preserved.

$$
\begin{array}{rcl}
\text{SafeA}(m) & = & \forall \mathit{fuel}.\ \text{typeStuck}(\text{run}\ \mathit{fuel}\ m) = \text{false} \\
\text{ResultOk}(m_{\text{orig}}, \Gamma, \tau, a, m, \kappa, I) & = & \text{Framed}(m_{\text{orig}}, m) \wedge \text{AnsOk}(\tau, m, a) \\
 & & {} \wedge (\forall v.\ a = \text{val}\,v \Rightarrow \text{StateOk}\,\kappa\,\Gamma\,I\,m) \\
\end{array}
$$

`Framed` is a complex predicate that asserts the stability of certain facts in
the machine. For example, one of the properties on `Framed` is this property
about the stability of inhabitants of certain "first order" types. The first
order set of types excludes closure types, for instance, which have captured
frames; a closure type's inhabitants can therefore be changed nonlocally.

$$
\forall \tau.\ \text{FirstOrder}(\tau) \Rightarrow \forall v.\ \text{denM}(\tau,m,v) \Rightarrow \text{denM}(\tau,m',v)
$$

Now that we have the run spec, we can define the full semantic judgement,
`SemSafeCtxA`. Notice that it has the same signature as the syntactic judgement:
it takes a context $\kappa$, an i-var spine, $I$, and a type context
$\Gamma$, an expression $e$, the type of $e$, $\tau$, and leaves
behind $\kappa';\ I';\ \Gamma'$. This can be read, "$e$ types as $\tau$ if this run
produces an inhabitant of the semantic denotation of $\tau$, or produces an
otherwise safe answer."

$$
\text{SemSafeCtxA}\ \kappa\ \Gamma\ I\ e\ \tau\ \kappa'\ \Gamma'\ I'
= \forall m.\ \text{StateOk}\ \kappa\ \Gamma\ I\ m \Rightarrow \text{RunSpec}(m, \text{evalFrom}(m,e), \Gamma', \tau, \kappa', I')
$$

$$
\text{evalFrom}(m,e) = m \text{ with } \mathit{ctl} := \text{eval}\,e,\ \mathit{kont} := [\,]
$$

### The judgement registry

Throughout the course of this project, I found that giving the agents a lot to
do up front caused them to struggle. Instead, giving agents very accessible
goalposts that are not far from each other is an effective way to steer them. I
devised a corpus of ruby programs, visible in the `ruby-lean` playground, that
ranges from dead simple to very complex, and the agent's task is to drive a
ratchet to its next "clink" by successfully modeling and typing each successive
program. `ruby-lean` models these clinks explicitly as a `Clink` structure.

```lean
structure Clink {F : Type} (S T : F) where
  name : String
  form : F → Prop          -- the rule, authored once
  syn  : form S            -- holds of the syntactic family: the DJudge constructor
  sem  : form T            -- holds of the semantic family: 
                           -- A PROOF, and it is a field
```

This structure links the syntactic judgements to the semantic ones. Some light
Lean metaprogramming is used to select judgement rules from the syntactic
inductive relation and demand proof obligations for them.

$$
\begin{array}{rcl}
\text{Closed}(\mathcal{R}, G) & = & \forall c \in \mathcal{R}.\ c.\text{form}\,G \\
(\text{DJudgeC}\ \mathcal{R}).\text{judge}\ \Gamma\,e\,\tau\,\Gamma' & = & \forall F : \text{DFam}.\ \text{Closed}(\mathcal{R}, F) \to F.\text{judge}\ \Gamma\,e\,\tau\,\Gamma'
\end{array}
$$

$$
\text{StuckFree}(m,p) = \forall \mathit{fuel}.\ \text{typeStuck}(\text{run}\ \mathit{fuel}\ (\text{evalFrom}(m,p))) = \text{false}
$$

### Soundness

**Theorem (Registry soundness, at every size).**

$$
(\text{DJudgeC}\ \mathcal{R}).\text{judge}\ \Gamma\,e\,\tau\,\Gamma'\ \kappa\,I\,\kappa'\,I' \Rightarrow \text{SemSafeCtxA}\ \kappa\,\Gamma\,I\,e\,\tau\,\kappa'\,\Gamma'\,I'
$$

*Proof sketch.* Instantiate $F := \text{dsemFam}$ and discharge $\text{Closed}$ from the clinks'
own `sem` fields. In Lean this is one line. It is unconditional: it held when
the registry had one rule in it and cannot stop holding as the registry grows.

**Theorem (Every syntactic derivation is certified).**

$$
\text{DJudge}\ \Gamma\ e\ \tau\ \Gamma'\ \kappa\ I\ \kappa'\ I' \Rightarrow (\text{DJudgeC}\ \text{dclinks}).\text{judge}\ \Gamma\ e\ \tau\ \Gamma'\ \kappa\ I\ \kappa'\ I'
$$

*Proof sketch.* Six-family mutual induction on the derivation, replacing each
constructor with its registered rule.

**Theorem (End to end).** For all programs $p$ and certificates $d$,

$$
\text{validateD}\ p\ d = \text{true} \ \wedge\ \text{bootOkB} = \text{true} \ \Longrightarrow\ \text{StuckFree}(\mathit{bootMachine},\ p)
$$

*Proof sketch.* $\text{validateD}\ p\ d = \text{true}$ yields a `DJudge` derivation by projection
(`validateD_typed`); the previous theorem lifts it to the certified judgment;
registry soundness gives its run contract; the contract's safety component at
the prelude-booted machine is the conclusion, with $\text{StateOk}$ at that machine
supplied by the `#guard`ed Boolean `bootOkB`.

<!-- 
### The theorems

#### Definitions

The fundamental definition that semantic type judgements talk about is the
denotation of types. This is what relates our syntactic definition of types,
$\tau$, given above, to sets of machine states and values.

$$
\text{denM} : \text{Ty} \to \text{Machine} \to \text{Value} \to \text{Prop}
$$

with $h = m.\mathit{heap}$:

$$
\begin{array}{rcl}
\text{denM}(\text{int}, m, v) & = & \text{isInt}(v) \\
\text{denM}(\text{cls}\,n, m, v) & = & \text{isAName}(h, v, n) \\
\text{denM}(\text{arrayOf}\,\tau, m, v) & = & \exists \bar{x}.\ \text{arrElems}(h,v) = \bar{x} \wedge \forall x \in \bar{x}.\ \text{denM}(\tau,m,x) \\
\text{denM}(\text{inst}\,n\,I, m, v) & = & \text{isExactInst}(h,v,n) \wedge \text{denSpine}(I, m, \text{ivarOf}(h,v)) \\
\text{denM}(\text{never}, m, v) & = & \text{False} \\
\text{denM}(\text{any}, m, v) & = & \text{True} \\
\text{denM}(\text{arrow}_0\,\rho, m, f) & = & \text{isProc}(h,f) \wedge \forall m_2 \sqsupseteq m,\ v,\ m'.\ \text{Returns}(m_2,f,[\,],v,m') \Rightarrow \text{denM}(\rho,m',v)
\end{array}
$$

**Conformance** is defined by $\text{StateOk}\ \kappa\ \Gamma\ I\ m$, which is a structure with 41 fields
relating the judgment's state $(\kappa, \Gamma, I)$ to a machine $m$.

**Answers** represent a notion of how an execution can respond, similar in
spirit to a result type in Rust. An execution can either deliver a value, or
some exceptional state.

```lean
inductive Answer where | val (v : Value) | esc (j : Jump)

def EscOk (m₀ : Machine) : Jump → Prop
  | .raiseJ exc => Semantics.isTypeError m₀.heap exc = false
  | .retJ _ _   => False
  | .throwJ _ _ => False
  | _           => True

def AnsOk (τ : Ty) (m₀ : Machine) : Answer → Prop
  | .val v => denM τ m₀ v
  | .esc j => EscOk m₀ j
```

```lean
def runA (fuel : Nat) (m : Machine) : ARes :=
  match answerPoint m with
  | some a => .ans a m fuel
  | none => match fuel with
    | 0 => .oof m
    | f + 1 => match Interp.stepFn m with
      | .next m' => runA f m'
      | .uncaught exc m' => .halt (.uncaught exc m')
      | ...
```

**Extension.** $\text{Ext}\ m\ m_2$ holds when the frame array and frame stack are
unchanged, the heap only grows, every old object id reads back identically,
nothing became or stopped being a class, and the ancestor walk is unmoved.

**Framing.** $\text{Framed}\ m\ m'$ is a six-field structure: the frame stack is unchanged;
every class stays a class; nominal types are preserved ($\text{isAName}$ is monotone);
every first-order type is preserved; inactive caller frames are preserved when
the activation has no captured parent ($\text{FramePres}$); and saved receivers retain
their field types ($\text{FieldsPres}$).

$$
\forall \tau.\ \text{FirstOrder}(\tau) \Rightarrow \forall v.\ \text{denM}(\tau,m,v) \Rightarrow \text{denM}(\tau,m',v)
$$

**Run contract.**

$$
\begin{array}{rcl}
\text{ResultOk}(m_{\text{orig}}, \Gamma, \tau, a, m, \kappa, I) & = & \text{Framed}(m_{\text{orig}}, m) \wedge \text{AnsOk}(\tau, m, a) \\
 & & {} \wedge (\forall v.\ a = \text{val}\,v \Rightarrow \text{StateOk}\,\kappa\,\Gamma\,I\,m) \\
\text{RunSpec}(m_{\text{orig}}, m_{\text{start}}, \Gamma, \tau, \kappa, I) & = & \text{SafeA}(m_{\text{start}}) \\
 & & {} \wedge \forall \mathit{fuel}\,a\,m\,\mathit{rest}.\ \text{runA}\ \mathit{fuel}\ m_{\text{start}} = \text{ans}\,a\,m\,\mathit{rest} \\
 & & \qquad \Rightarrow \text{ResultOk}(m_{\text{orig}}, \Gamma, \tau, a, m, \kappa, I)
\end{array}
$$

$$
\text{SafeA}(m) = \forall \mathit{fuel}.\ \text{typeStuck}(\text{run}\ \mathit{fuel}\ m) = \text{false}
$$

**Semantic judgment.**

$$
\text{SemSafeCtxA}\ \kappa\ \Gamma\ I\ e\ \tau\ \kappa'\ \Gamma'\ I'
= \forall m.\ \text{StateOk}\ \kappa\ \Gamma\ I\ m \Rightarrow \text{RunSpec}(m, \text{evalFrom}(m,e), \Gamma', \tau, \kappa', I')
$$

$$
\text{evalFrom}(m,e) = m \text{ with } \mathit{ctl} := \text{eval}\,e,\ \mathit{kont} := [\,]
$$

**Rules as clinks.**

```lean
structure Clink {F : Type} (S T : F) where
  name : String
  form : F → Prop          -- the rule, authored once
  syn  : form S            -- holds of the syntactic family: the DJudge constructor
  sem  : form T            -- holds of the semantic family: A PROOF, and it is a field
```

$$
\begin{array}{rcl}
\text{Closed}(\mathcal{R}, G) & = & \forall c \in \mathcal{R}.\ c.\text{form}\,G \\
(\text{DJudgeC}\ \mathcal{R}).\text{judge}\ \Gamma\,e\,\tau\,\Gamma' & = & \forall F : \text{DFam}.\ \text{Closed}(\mathcal{R}, F) \to F.\text{judge}\ \Gamma\,e\,\tau\,\Gamma'
\end{array}
$$

$$
\text{StuckFree}(m,p) = \forall \mathit{fuel}.\ \text{typeStuck}(\text{run}\ \mathit{fuel}\ (\text{evalFrom}(m,p))) = \text{false}
$$

### Soundness

**Theorem (Registry soundness, at every size).**

$$
(\text{DJudgeC}\ \mathcal{R}).\text{judge}\ \Gamma\,e\,\tau\,\Gamma'\ \kappa\,I\,\kappa'\,I' \Rightarrow \text{SemSafeCtxA}\ \kappa\,\Gamma\,I\,e\,\tau\,\kappa'\,\Gamma'\,I'
$$

*Proof sketch.* Instantiate $F := \text{dsemFam}$ and discharge $\text{Closed}$ from the clinks'
own `sem` fields. In Lean this is one line. It is unconditional: it held when
the registry had one rule in it and cannot stop holding as the registry grows.

**Theorem (Every syntactic derivation is certified).**

$$
\text{DJudge}\ \Gamma\ e\ \tau\ \Gamma'\ \kappa\ I\ \kappa'\ I' \Rightarrow (\text{DJudgeC}\ \text{dclinks}).\text{judge}\ \Gamma\ e\ \tau\ \Gamma'\ \kappa\ I\ \kappa'\ I'
$$

*Proof sketch.* Six-family mutual induction on the derivation, replacing each
constructor with its registered rule.

**Theorem (End to end).** For all programs $p$ and certificates $d$,

$$
\text{validateD}\ p\ d = \text{true} \ \wedge\ \text{bootOkB} = \text{true} \ \Longrightarrow\ \text{StuckFree}(\mathit{bootMachine},\ p)
$$

*Proof sketch.* $\text{validateD}\ p\ d = \text{true}$ yields a `DJudge` derivation by projection
(`validateD_typed`); the previous theorem lifts it to the certified judgment;
registry soundness gives its run contract; the contract's safety component at
the prelude-booted machine is the conclusion, with $\text{StateOk}$ at that machine
supplied by the `#guard`ed Boolean `bootOkB`. -->

## Lemmata

For the curious reader, here are the lemmata that were instrumental in
completing the soundness proof.

**Lemma (`denM_ext`).**

$$
\text{Ext}\ m\ m_2 \Rightarrow \text{denM}(\tau, m, v) \Rightarrow \text{denM}(\tau, m_2, v)
$$

for every $\tau$, simultaneously with the corresponding statement for
spines.

**Lemma (`StateOk_ext`).** If $\text{StateOk}\ \kappa\ \Gamma\ I\ m$ and $\text{Ext}\ m\ m_2$, and $m_2$'s
string, array and hash payloads are well-formed and its prelude phase is
unchanged, then $\text{StateOk}\ \kappa\ \Gamma\ I\ m_2$.

**Lemma (`denM_heap_only`, `denM_ctl`).** For first-order $\tau$, $\text{denM}(\tau,m_1,v) \leftrightarrow \text{denM}(\tau,m_2,v)$
whenever $m_1$ and $m_2$ have the same heap; and $\text{denM}$ is
invariant under changing the control word and continuation stack.

**Lemma (`denM_setLocal`).** If $\text{denM}(\tau', m, w)$ and $\text{capStale}(x,\tau',\tau) = \text{false}$, then $\text{denM}(\tau, m, v) \Rightarrow \text{denM}(\tau, m.\text{setLocal}(x,w), v)$.

**Lemma (`StateOk_setLocal`).** Given $\text{StateOk}\ \kappa\ \Gamma\ I\ m$, $\text{denM}(\tau,m,w)$, $\text{capStale}(x,\tau,\tau) = \text{false}$,
$\text{capStaleCtx}(x,\tau,\kappa) = \text{false}$, $\text{stripAlias}(\rho) = \tau$, and an alias side condition, conformance holds at the
environment

$$
\text{envAfter}(\Gamma,x,\tau) = \text{envSet}\bigl(\text{killClosOver}(\text{killAliasesTo}(\Gamma,x),x,\tau),\,x,\,\tau\bigr)
$$

and spine $\text{killClosOverSpine}(I,x,\tau)$.

**Lemma (`run_pushK`).** For any catch-free continuation $K$:

$$
\text{run}\ \mathit{fuel}\ (\text{pushK}\ K\ m) = (\text{runA}\ \mathit{fuel}\ m).\text{out}\ K
$$

**Lemma (`safe_pushK`).** If $K$ is catch-free, $Q$ is blind to
halts, $Q$ holds of out-of-fuel, $Q$ holds of every run from
$m$, $m$ delivers answers satisfying $P$, and $K$ is
safe for $P$-answers with respect to $Q$, then $Q$ holds of
every run from $\text{pushK}\ K\ m$.

**Lemma (`RunSpec.bind`, `RunSpec.step`, `RunSpec.rebase`, `RunSpec.weaken`).**
The run contract is closed under: taking a step ($\text{answerPoint} = \text{none}$ and $\text{step}\ m = \text{next}\ m'$),
pushing a frame and continuing with a contract for the delivered answer,
re-basing the framing origin along a $\text{Framed}$, and weakening the outgoing
indices.

**Lemma (`enterUserMethod_required`).** For a method whose parameters are all
required positionals, with no captured frame and no declared locals, and an
argument list of matching length, the interpreter's method-entry function
reduces to: push a specific frame, evaluate the body, with a specific return
frame on the continuation stack.

**Lemma (`requiredFrame_envOk`).** If the arguments inhabit the declared
parameter types at the caller's machine, and those types are first-order and
alias-free, then the pushed frame satisfies `EnvOk` at the parameter
environment.

**Lemma (`MethodLookup`, `checked_top_call`).** Conformance determines the entry
that dispatch will actually find for a declared name; combined with a checked
body, the call reduces to executing exactly that body.

**Lemma (`InitGrow.denM`, `Framed.of_initGrow`).** First-order denotations of
old values survive an $\text{InitGrow}$; and an $\text{InitGrow}$ with an unchanged stack and
$\text{FramePres}$ is a $\text{Framed}$.
