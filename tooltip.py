"""Tooltip support for markdown posts.

Syntax: [visible text]^(tooltip content)

Desktop: renders as a CSS hover bubble.
Mobile: renders as numbered superscripts linking to a footnote section appended
        to the post body.
"""

import re
import xml.etree.ElementTree as etree

from markdown.extensions import Extension
from markdown.inlinepatterns import InlineProcessor

_TOOLTIP_RE = r'\[([^\]]*)\]\^\(([^)]+)\)'
_PLACEHOLDER_PREFIX = "XTOOLTIP"
_PLACEHOLDER_SUFFIX = "X"


class _TooltipPattern(InlineProcessor):
    def handleMatch(self, m, data):
        el = etree.Element("span")
        el.set("class", "tooltip")
        el.set("data-tip", m.group(2))
        el.set("tabindex", "0")
        el.text = m.group(1)
        return el, m.start(0), m.end(0)


class TooltipExtension(Extension):
    def extendMarkdown(self, md):
        # Priority 175 > links (160) so tooltip syntax matches first
        md.inlinePatterns.register(_TooltipPattern(_TOOLTIP_RE, md), "tooltip", 175)


def preserve_tooltips(body: str, tooltip_map: dict) -> str:
    """Replace tooltip syntax with placeholders before mdformat runs."""
    def _replace(m):
        key = f"{_PLACEHOLDER_PREFIX}{len(tooltip_map)}{_PLACEHOLDER_SUFFIX}"
        tooltip_map[key] = m.group(0)
        return key
    return re.sub(_TOOLTIP_RE, _replace, body)


def restore_tooltips(body: str, tooltip_map: dict) -> str:
    """Restore tooltip syntax from placeholders after mdformat runs."""
    for key, val in tooltip_map.items():
        body = body.replace(key, val)
    return body


_SPAN_RE = re.compile(
    r'<span class="tooltip" data-tip="([^"]*)" tabindex="0">([^<]*)</span>'
)


def add_tooltip_footnotes(html: str) -> str:
    """Post-process rendered HTML to number tooltips and append a footnote section.

    Each tooltip span gains an id and a hidden superscript link. A
    <section class="tooltip-footnotes"> is appended for mobile display.
    """
    tooltips: list[str] = []

    def _replace(m: re.Match) -> str:
        n = len(tooltips) + 1
        tip, text = m.group(1), m.group(2)
        tooltips.append(tip)
        return (
            f'<a class="tooltip" data-tip="{tip}" href="#tooltip-def-{n}" id="tooltip-ref-{n}">'
            f'{text}<sup>{n}</sup>'
            f'</a>'
        )

    html = _SPAN_RE.sub(_replace, html)

    if not tooltips:
        return html

    items = "\n".join(
        f'        <li id="tooltip-def-{i + 1}">{tip} '
        f'<a class="tooltip-back" href="#tooltip-ref-{i + 1}">↩</a></li>'
        for i, tip in enumerate(tooltips)
    )
    footnotes = (
        '\n<section class="tooltip-footnotes">\n'
        '    <hr class="tooltip-footnotes-rule">\n'
        '    <ol>\n'
        f'{items}\n'
        '    </ol>\n'
        '</section>'
    )
    return html + footnotes
