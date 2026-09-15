// MCP server StudyFlow — tudy do appky sahá cizí Claude.
//
// Proč vlastní implementace a ne SDK: potřebujeme přesně tři věci z protokolu
// (initialize, tools/list, tools/call) přes obyčejné POST/JSON. Streamovaná
// varianta se SSE by přinesla relace a udržování spojení, což tenhle server
// dělat nemusí — každé volání stojí samo o sobě a autentizuje se hlavičkou.
//
// Připojení na straně uživatele:
//   claude mcp add --transport http studyflow https://study.dmarka.eu/mcp \
//     --header "Authorization: Bearer sf_…"
import {
  addLectureFor,
  packSummary,
  pubUserId,
  savePackFor,
  startPackFor,
} from './pub-routes.js'
import { deletePack } from './pub.js'

const PROTOCOL_VERSION = '2025-06-18'

// Popis slidu je v nástrojích třikrát, tak ať je aspoň na jednom místě.
const SLIDE_SCHEMA = {
  type: 'object',
  required: ['title'],
  properties: {
    n: { type: 'integer', description: 'Pořadí ve výkladu. Když chybí, doplní se.' },
    title: { type: 'string', description: 'Nadpis oddílu — v učebnici je vidět jako první.' },
    text: {
      type: 'string',
      description:
        'Souvislý výklad oddílu. Ne odrážky z prezentace, ale text, ze kterého se dá učit: co to je, proč to tak je, na co se ptá zkouška.',
    },
    terms: {
      type: 'array',
      description: 'Odborné termíny, které oddíl zavádí.',
      items: {
        type: 'object',
        required: ['term', 'def'],
        properties: { term: { type: 'string' }, def: { type: 'string' } },
      },
    },
    cards: {
      type: 'array',
      description:
        'Otázky k tomuhle oddílu. Jdou rovnou do opakování — proto musí být zodpověditelné z textu oddílu a odpověď musí být úplná, ne odkaz na text.',
      items: {
        type: 'object',
        required: ['q', 'a'],
        properties: {
          q: { type: 'string', description: 'Otázka.' },
          a: { type: 'string', description: 'Úplná odpověď.' },
          kind: {
            type: 'string',
            description:
              'Druh karty: basic, definice, znaky, schema, pripad, rozliseni, norma, judikat, proces, mapa, cisla, srovnani, model, graf.',
          },
          level: { type: 'integer', description: '1 zapamatování, 2 porozumění, 3 použití.' },
          topic: { type: 'string', description: 'Téma; když chybí, bere se název přednášky.' },
        },
      },
    },
  },
}

const LECTURE_PROPS = {
  id: {
    type: 'string',
    description: 'Krátké ID v rámci učebnice, písmena a číslice, např. L01. Stejné ID přepíše dřívější přednášku.',
  },
  unit: { type: 'string', description: 'Označení tématu, např. „Téma 3“.' },
  title: { type: 'string', description: 'Název přednášky.' },
  slides: { type: 'array', description: 'Oddíly výkladu.', items: SLIDE_SCHEMA },
}

const TOOLS = [
  {
    name: 'studyflow_list_packs',
    description:
      'Vypíše učebnice, které už uživatel ve StudyFlow má — název, počet přednášek a karet. Volej jako první, ať nezaložíš duplicitní učebnici.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'studyflow_start_pack',
    description:
      'Založí prázdnou učebnici. Používej, když budeš přednášky přidávat po jedné přes studyflow_add_lecture — což je správný postup u všeho většího než dvě tři přednášky. Učebnice se v appce objeví až s první přednáškou.',
    inputSchema: {
      type: 'object',
      required: ['slug', 'subject'],
      properties: {
        slug: { type: 'string', description: 'Krátké jméno bez diakritiky, např. ustavni-pravo.' },
        subject: { type: 'string', description: 'Název předmětu, jak ho uvidí uživatel.' },
        title: { type: 'string', description: 'Název kurzu, když se liší od předmětu.' },
        examDate: { type: 'string', description: 'Datum zkoušky RRRR-MM-DD. Řídí podle něj plánování.' },
        code: { type: 'string', description: 'Zkratka kurzu, písmena a číslice.' },
        number: { type: 'string', description: 'Číslo kurzu ze studijního systému.' },
      },
    },
  },
  {
    name: 'studyflow_add_lecture',
    description:
      'Přidá do učebnice jednu přednášku — výklad i otázky k ní. Přednáška se stejným ID se přepíše, takže se dá opravovat. Otázky piš k oddílům, ne zvlášť: uživatel pak v appce vidí u karty i výklad, ze kterého vyšla.',
    inputSchema: {
      type: 'object',
      required: ['slug', 'id', 'title', 'slides'],
      properties: { slug: { type: 'string' }, ...LECTURE_PROPS },
    },
  },
  {
    name: 'studyflow_put_pack',
    description:
      'Nahraje celou učebnici najednou a přepíše, co pod tím jménem bylo. Hodí se na malé učebnice; u velkých použij studyflow_start_pack a pak studyflow_add_lecture, jinak posíláš pokaždé všechno znovu.',
    inputSchema: {
      type: 'object',
      required: ['slug', 'subject', 'lectures'],
      properties: {
        slug: { type: 'string' },
        subject: { type: 'string' },
        title: { type: 'string' },
        examDate: { type: 'string', description: 'RRRR-MM-DD.' },
        code: { type: 'string' },
        number: { type: 'string' },
        lectures: {
          type: 'array',
          items: { type: 'object', required: ['id', 'title', 'slides'], properties: LECTURE_PROPS },
        },
      },
    },
  },
  {
    name: 'studyflow_delete_pack',
    description: 'Smaže učebnici i její karty ze StudyFlow. Nevratné — ptej se, než to zavoláš.',
    inputSchema: {
      type: 'object',
      required: ['slug'],
      properties: { slug: { type: 'string' } },
    },
  },
]

const INSTRUCTIONS = `StudyFlow je učicí aplikace: učebnice ke čtení a kartičky k opakování (FSRS).

Jak dělat dobrou učebnici:
- Jedna přednáška = jedno téma zkoušky. Oddíl (slide) = jedna myšlenka.
- Do "text" piš souvislý výklad, ne odrážky opsané z prezentace. Uživatel se z toho učí sám, bez přednášejícího.
- Otázky patří k oddílu, ze kterého se dají zodpovědět. Odpověď musí stát sama o sobě.
- Zachovej jazyk podkladů a nepřekládej odborné termíny.
- U většího předmětu: studyflow_start_pack, pak studyflow_add_lecture po jedné přednášce.`

function jsonResult(id, payload) {
  return {
    jsonrpc: '2.0',
    id,
    result: { content: [{ type: 'text', text: JSON.stringify(payload) }] },
  }
}

function jsonError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

/** Chyba nástroje patří do výsledku s isError, ne do chyby JSON-RPC. */
function toolFailure(id, error) {
  return {
    jsonrpc: '2.0',
    id,
    result: { content: [{ type: 'text', text: `chyba: ${error}` }], isError: true },
  }
}

function callTool(userId, name, args) {
  switch (name) {
    case 'studyflow_list_packs':
      return { packs: packSummary(userId) }
    case 'studyflow_start_pack': {
      const { slug, ...header } = args
      return startPackFor(userId, slug, header)
    }
    case 'studyflow_add_lecture': {
      const { slug, ...lecture } = args
      return addLectureFor(userId, slug, lecture)
    }
    case 'studyflow_put_pack': {
      const { slug, ...pack } = args
      return savePackFor(userId, slug, pack)
    }
    case 'studyflow_delete_pack':
      return deletePack(userId, String(args.slug ?? ''))
        ? { deleted: args.slug, packs: packSummary(userId) }
        : { error: 'unknown-pack' }
    default:
      return { error: `unknown-tool:${name}` }
  }
}

export function registerMcpRoutes(app) {
  // Klient, který chce SSE proud, ho tu nedostane — a ať to ví hned.
  app.get('/mcp', async (_req, reply) => reply.code(405).send({ error: 'method-not-allowed' }))

  app.post('/mcp', async (req, reply) => {
    const message = req.body ?? {}
    const { id = null, method } = message

    // Oznámení (bez id) se nepotvrzují ničím než prázdnou odpovědí.
    if (method?.startsWith('notifications/')) return reply.code(202).send()

    if (method === 'initialize') {
      // Přihlášení se ověří až u nástrojů: klient si nejdřív jen ohmatá server.
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'studyflow', version: '1.0.0' },
          instructions: INSTRUCTIONS,
        },
      }
    }

    if (method === 'ping') return { jsonrpc: '2.0', id, result: {} }

    if (method === 'tools/list') {
      return { jsonrpc: '2.0', id, result: { tools: TOOLS } }
    }

    if (method === 'tools/call') {
      const userId = pubUserId(req, reply)
      if (!userId) return
      const name = message.params?.name
      const args = message.params?.arguments ?? {}
      let out
      try {
        out = callTool(userId, name, args)
      } catch (err) {
        req.log.error({ err, name }, 'mcp tool failed')
        return toolFailure(id, 'internal')
      }
      if (out?.error) return toolFailure(id, out.error)
      return jsonResult(id, out)
    }

    return jsonError(id, -32601, `unknown method: ${method}`)
  })
}
