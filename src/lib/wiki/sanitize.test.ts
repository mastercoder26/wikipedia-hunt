import { describe, expect, test } from 'vitest'
import { sanitizeArticleHtml } from '@/lib/wiki/sanitize'

function parse(html: string): Document {
  return new DOMParser().parseFromString(sanitizeArticleHtml(html), 'text/html')
}

describe('sanitizeArticleHtml', () => {
  test('converts internal article links into wd-link anchors with data-wiki-key', () => {
    // Arrange
    const html = '<p><a href="/wiki/Apollo_11" title="Apollo 11">Apollo 11</a></p>'

    // Act
    const anchor = parse(html).querySelector('a')

    // Assert
    expect(anchor).not.toBeNull()
    expect(anchor?.getAttribute('data-wiki-key')).toBe('Apollo_11')
    expect(anchor?.getAttribute('data-wiki-title')).toBe('Apollo 11')
    expect(anchor?.getAttribute('href')).toBe('#')
    expect(anchor?.className).toBe('wd-link')
  })

  test('strips the fragment and percent-decodes the article key', () => {
    // Arrange
    const html = '<a href="/wiki/Caf%C3%A9_wall_illusion#History">Café wall</a>'

    // Act
    const anchor = parse(html).querySelector('a')

    // Assert
    expect(anchor?.getAttribute('data-wiki-key')).toBe('Café_wall_illusion')
  })

  test('disables namespaced links (File:, Wikipedia:, Special:) but keeps their text', () => {
    // Arrange
    const html = [
      '<a href="/wiki/File:Moon.jpg">Moon photo</a>',
      '<a href="/wiki/Wikipedia:About">About</a>',
      '<a href="/wiki/Special:Search">Search</a>',
      '<a href="/wiki/Category:Physics">Physics</a>',
    ].join('')

    // Act
    const doc = parse(html)

    // Assert
    expect(doc.querySelectorAll('a')).toHaveLength(0)
    expect(doc.querySelectorAll('span.wd-link-disabled')).toHaveLength(4)
    expect(doc.body.textContent).toContain('Moon photo')
    expect(doc.body.textContent).toContain('Search')
  })

  test('disables external http links', () => {
    // Arrange
    const html = '<a class="external" href="https://example.com/foo">Example</a>'

    // Act
    const doc = parse(html)

    // Assert
    expect(doc.querySelector('a')).toBeNull()
    expect(doc.querySelector('span.wd-link-disabled')?.textContent).toBe('Example')
  })

  test('disables red links even when they point at /wiki/', () => {
    // Arrange
    const html = '<a href="/wiki/Nonexistent_page" class="new">Nonexistent</a>'

    // Act & Assert
    expect(parse(html).querySelector('a')).toBeNull()
  })

  test('rewrites same-page citation anchors to inert spans', () => {
    // Arrange
    const html = '<p>text<a href="#cite_note-5">[5]</a></p>'

    // Act
    const doc = parse(html)

    // Assert
    expect(doc.querySelector('a')).toBeNull()
    expect(doc.querySelector('span.wd-link-disabled')?.textContent).toBe('[5]')
  })

  test('strips target="_blank", rel and on* handlers everywhere', () => {
    // Arrange
    const html =
      '<div onmouseover="steal()"><a href="/wiki/Moon" target="_blank" rel="noopener" onclick="go()">Moon</a></div>'

    // Act
    const doc = parse(html)
    const anchor = doc.querySelector('a')

    // Assert
    expect(doc.body.innerHTML).not.toContain('_blank')
    expect(anchor?.hasAttribute('target')).toBe(false)
    expect(anchor?.hasAttribute('rel')).toBe(false)
    expect(anchor?.hasAttribute('onclick')).toBe(false)
    expect(doc.querySelector('div')?.hasAttribute('onmouseover')).toBe(false)
  })

  test('removes non-anchor navigation, embedded documents and CSS URLs', () => {
    // Arrange
    const html = [
      '<form action="/w/index.php?search=Target"><button formaction="https://example.com">Search</button></form>',
      '<map name="escape"><area href="https://example.com" target="_blank"></map>',
      '<iframe src="https://example.com" srcdoc="<a href=/wiki/Target>Target</a>"></iframe>',
      '<object data="https://example.com"></object><embed src="https://example.com">',
      '<svg><use href="https://example.com/icon.svg#x"></use></svg>',
      '<div style="background-image:url(https://example.com/target)">Styled</div>',
    ].join('')

    // Act
    const doc = parse(html)

    // Assert
    expect(doc.querySelector('form, area, iframe, object, embed')).toBeNull()
    expect(doc.querySelector('[action], [formaction], [srcdoc], [data], [href]:not(a.wd-link)')).toBeNull()
    expect(doc.querySelector('[src]:not(img):not(source):not(audio):not(video)')).toBeNull()
    expect(doc.querySelector('[style*="url" i]')).toBeNull()
  })

  test('fixes protocol-relative and root-relative image sources and adds lazy loading', () => {
    // Arrange
    const html =
      '<img src="//upload.wikimedia.org/a.jpg" srcset="//upload.wikimedia.org/a.jpg 1x, //upload.wikimedia.org/b.jpg 2x" loading="eager">' +
      '<img src="/w/extensions/x.png">'

    // Act
    const images = Array.from(parse(html).querySelectorAll('img'))

    // Assert
    expect(images[0].getAttribute('src')).toBe('https://upload.wikimedia.org/a.jpg')
    expect(images[0].getAttribute('srcset')).toBe(
      'https://upload.wikimedia.org/a.jpg 1x, https://upload.wikimedia.org/b.jpg 2x',
    )
    expect(images[0].getAttribute('loading')).toBe('lazy')
    expect(images[1].getAttribute('src')).toBe('https://en.wikipedia.org/w/extensions/x.png')
  })

  test('removes inline sup.reference markers and the reference list', () => {
    // Arrange
    const html =
      '<p>Fact<sup class="reference" id="cite_ref-1"><a href="#cite_note-1">[1]</a></sup></p>' +
      '<div class="reflist"><ol><li>A source</li></ol></div>'

    // Act
    const doc = parse(html)

    // Assert
    expect(doc.querySelector('sup.reference')).toBeNull()
    expect(doc.querySelector('.reflist')).toBeNull()
    expect(doc.body.textContent).toContain('Fact')
    expect(doc.body.textContent).not.toContain('[1]')
  })

  test('removes scripts, edit sections and navboxes but keeps infoboxes and hatnotes', () => {
    // Arrange
    const html =
      '<script>alert(1)</script>' +
      '<span class="mw-editsection">edit</span>' +
      '<table class="navbox"><tr><td>nav</td></tr></table>' +
      '<div class="hatnote">See also <a href="/wiki/Moon">Moon</a></div>' +
      '<table class="infobox"><tr><td><a href="/wiki/Earth">Earth</a></td></tr></table>'

    // Act
    const doc = parse(html)

    // Assert
    expect(doc.querySelector('script')).toBeNull()
    expect(doc.querySelector('.mw-editsection')).toBeNull()
    expect(doc.querySelector('.navbox')).toBeNull()
    expect(doc.querySelector('.hatnote')).not.toBeNull()
    expect(doc.querySelector('.infobox')).not.toBeNull()
    expect(doc.querySelectorAll('a.wd-link')).toHaveLength(2)
  })

  test('returns an empty string for empty input', () => {
    // Arrange, Act & Assert
    expect(sanitizeArticleHtml('')).toBe('')
    expect(sanitizeArticleHtml('   ')).toBe('')
  })
})
