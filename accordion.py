"""Collapsible accordion blocks for markdown posts.

Syntax::

    ::: details Show the desugared output
    Any markdown, including fenced code blocks.
    :::

renders as a native <details>/<summary> disclosure widget. The summary text is
optional and defaults to "Details"; it is parsed as inline markdown.
"""

import re
import xml.etree.ElementTree as etree

from markdown.blockprocessors import BlockProcessor
from markdown.extensions import Extension

START_RE = re.compile(r"^:{3,}[ \t]*details\b[ \t]*(.*?)[ \t]*$", re.IGNORECASE)
END_RE = re.compile(r"^:{3,}[ \t]*$")
FENCE_RE = re.compile(r"^(?:```|~~~)")

DEFAULT_SUMMARY = "Details"

_PLACEHOLDER_PREFIX = "XACCORDION"
_PLACEHOLDER_SUFFIX = "X"
_PLACEHOLDER_RE = re.compile(rf"^{_PLACEHOLDER_PREFIX}\d+{_PLACEHOLDER_SUFFIX}$")


class _AccordionProcessor(BlockProcessor):
    """Consume blocks from the opening marker up to the matching ``:::``."""

    def test(self, parent, block):
        return bool(START_RE.match(block.split("\n", 1)[0]))

    def run(self, parent, blocks):
        lines = blocks.pop(0).split("\n")
        summary = START_RE.match(lines[0]).group(1) or DEFAULT_SUMMARY

        # Content may start on the line right after the marker, with no blank
        # line in between, in which case it is part of this same block.
        first = "\n".join(lines[1:])
        pending = ([first] if first.strip() else []) + blocks

        body = []
        while pending:
            block = pending.pop(0)
            block_lines = block.split("\n")
            end = next((i for i, l in enumerate(block_lines) if END_RE.match(l)), None)
            if end is None:
                body.append(block)
                continue
            before = "\n".join(block_lines[:end])
            after = "\n".join(block_lines[end + 1:])
            if before.strip():
                body.append(before)
            if after.strip():
                pending.insert(0, after)
            break
        # An unterminated block just runs to the end of the document.
        blocks[:] = pending

        el = etree.SubElement(parent, "details")
        el.set("class", "accordion")
        etree.SubElement(el, "summary").text = summary
        inner = etree.SubElement(el, "div")
        inner.set("class", "accordion-body")
        self.parser.parseChunk(inner, "\n\n".join(body))


class AccordionExtension(Extension):
    def extendMarkdown(self, md):
        # Above 'paragraph' (10) and the other default block processors so the
        # marker lines are never swallowed as ordinary text.
        md.parser.blockprocessors.register(
            _AccordionProcessor(md.parser), "accordion", 105
        )


def preserve_accordions(body: str, accordion_map: dict) -> str:
    """Replace accordion marker lines with placeholders before mdformat runs.

    mdformat does not know the syntax and would reflow the markers into the
    surrounding paragraphs, so each marker line is swapped for a standalone
    placeholder paragraph that survives formatting untouched.
    """
    out = []
    in_fence = False
    for line in body.split("\n"):
        if FENCE_RE.match(line):
            in_fence = not in_fence
        elif not in_fence and (START_RE.match(line) or END_RE.match(line)):
            key = f"{_PLACEHOLDER_PREFIX}{len(accordion_map)}{_PLACEHOLDER_SUFFIX}"
            accordion_map[key] = line
            # Blank lines keep the placeholder its own paragraph.
            out.extend(["", key, ""])
            continue
        out.append(line)
    return "\n".join(out)


def restore_accordions(body: str, accordion_map: dict) -> str:
    """Restore accordion marker lines from placeholders after mdformat runs."""
    lines = []
    for line in body.split("\n"):
        stripped = line.strip()
        if _PLACEHOLDER_RE.match(stripped) and stripped in accordion_map:
            lines.append(accordion_map[stripped])
        else:
            lines.append(line)
    return "\n".join(lines)
