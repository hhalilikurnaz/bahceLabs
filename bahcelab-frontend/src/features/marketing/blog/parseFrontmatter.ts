/** Blog markdown dosyaları için basit YAML frontmatter (gray-matter yerine). */
export function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw.trim())
  if (!match) return { data: {}, content: raw }

  const yaml = match[1]
  const content = match[2].trim()
  const data: Record<string, unknown> = {}
  let listKey: string | null = null

  for (const line of yaml.split('\n')) {
    const listItem = /^  - (.+)$/.exec(line)
    if (listItem && listKey) {
      const arr = data[listKey] as string[]
      arr.push(listItem[1].trim())
      continue
    }

    const field = /^([a-zA-Z]+):\s*(.*)$/.exec(line)
    if (!field) continue

    const [, key, value] = field
    if (value === '') {
      listKey = key
      data[key] = []
      continue
    }

    listKey = null
    data[key] = value.replace(/^["']|["']$/g, '')
  }

  return { data, content }
}
