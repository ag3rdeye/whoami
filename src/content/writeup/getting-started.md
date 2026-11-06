---
title: 'Welcome to the Writeup Section'
description: 'A sample article showing how writeups render, including code blocks, tables, and a table of contents.'
publishDate: 2025-01-15
category: 'Learning Notes'
tags: ['meta', 'astro']
author: 'Arjun Giri'
draft: false
featured: true
references:
  - label: 'Astro documentation'
    url: 'https://docs.astro.build/'
---

This is a sample writeup. It demonstrates the reading experience: typography, code
highlighting, copy buttons, tables, and an automatic table of contents. Replace or delete
this file once you publish real content.

## Writing articles

Articles live in `src/content/writeup/` as Markdown or MDX files. Each file needs
frontmatter that matches the content schema. Set `draft: false` to publish.

### Code blocks

Fenced code blocks are highlighted automatically and get a copy button on hover.

```ts
export function greet(name: string): string {
  return `Hello, ${name}`;
}
```

### Tables

Tables render responsively and scroll on small screens.

| Field     | Type    | Required |
| --------- | ------- | -------- |
| title     | string  | yes      |
| draft     | boolean | no       |
| featured  | boolean | no       |

## Next steps

Edit this content through the CMS or directly in the repository. When you push to the
main branch, the site rebuilds and deploys automatically.
