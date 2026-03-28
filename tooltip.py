"""Tooltip support for markdown posts.

Syntax: [visible text]^(tooltip content)
Renders as a CSS-only styled tooltip that inherits the post's theme.
"""

import re
import xml.etree.ElementTree as etree

from markdown.extensions import Extension
from markdown.inlinepatterns import InlineProcessor

_TOOLTIP_RE = r'\[([^\]]+)\]\^\(([^)]+)\)'
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
