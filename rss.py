#!/usr/bin/env python3
"""Generate RSS 2.0 feed for samx.io blog."""

import datetime
from pathlib import Path

BASE_URL = "https://samx.io"
FEED_PATH = Path(__file__).parent / "feed.xml"


def _rfc822(date: datetime.date) -> str:
    dt = datetime.datetime(date.year, date.month, date.day, tzinfo=datetime.timezone.utc)
    return dt.strftime("%a, %d %b %Y %H:%M:%S +0000")


def _escape_xml(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _cdata(text: str) -> str:
    return "<![CDATA[" + text.replace("]]>", "]]]]><![CDATA[>") + "]]>"


def _build_xml(posts) -> str:
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")
    feed_url = f"{BASE_URL}/feed.xml"

    items = []
    for post in posts:
        url = f"{BASE_URL}/blog/{post.slug}.html"
        items.append(
            f"    <item>\n"
            f"      <title>{_escape_xml(post.title)}</title>\n"
            f"      <link>{url}</link>\n"
            f"      <guid isPermaLink=\"true\">{url}</guid>\n"
            f"      <pubDate>{_rfc822(post.date)}</pubDate>\n"
            f"      <description>{_cdata(post.description or post.title)}</description>\n"
            f"      <content:encoded>{_cdata(post.html_body)}</content:encoded>\n"
            f"    </item>"
        )

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0"\n'
        '  xmlns:atom="http://www.w3.org/2005/Atom"\n'
        '  xmlns:content="http://purl.org/rss/1.0/modules/content/">\n'
        "  <channel>\n"
        "    <title>Sam Xifaras</title>\n"
        f"    <link>{BASE_URL}/blog/</link>\n"
        "    <description>Blog by Sam Xifaras</description>\n"
        "    <language>en</language>\n"
        f"    <lastBuildDate>{now}</lastBuildDate>\n"
        f'    <atom:link href="{feed_url}" rel="self" type="application/rss+xml"/>\n'
        + "\n".join(items)
        + "\n  </channel>\n</rss>\n"
    )


def build_feed(posts) -> None:
    """Write feed.xml to the site root from a list of PostData objects."""
    FEED_PATH.write_text(_build_xml(posts), encoding="utf-8")
    print(f"  Built: feed.xml ({len(posts)} item(s))")
