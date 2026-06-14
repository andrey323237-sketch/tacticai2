// Загружаем .env только для локальной разработки
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const express = require('express');
const fetch   = require('node-fetch');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// Логи для диагностики Railway
console.log("🚀 Starting server...");
console.log("PORT:", PORT);
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("API Key exists:", !!process.env.ANTHROPIC_API_KEY);

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Rate limit: max 10 requests / hour per IP ──
const ipLog = new Map();
function rateLimit(req, res, next) {
  const ip  = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const entry = ipLog.get(ip) || { count: 0, reset: now + hour };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + hour; }
  entry.count++;
  ipLog.set(ip, entry);
  if (entry.count > 10) {
    return res.status(429).json({ error: 'Слишком много запросов. Подождите час.' });
  }
  next();
}

// ── Health check для Railway ──
app.get('/health', (_, res) => res.status(200).json({ ok: true }));

// ── Main proxy endpoint ─────────────────────────────────────────────────────
app.post('/api/analyze', rateLimit, async (req, res) => {
  const { team1, team2, matchDate, league, matchTime, oddsText } = req.body;

  if (!team1 || !team2) {
    return res.status(400).json({ error: 'Укажите обе команды.' });
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return res.status(500).json({ error: 'API-ключ не настроен на сервере.' });
  }

  const today    = new Date().toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' });
  const dateInfo = matchDate
    ? new Date(matchDate).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })
    : 'не указана';

  const systemPrompt = `Ты — ведущий профессиональный футбольный аналитик и эксперт по ставкам с 15-летним опытом.
Твоя задача: провести максимально детальный анализ матча, используя веб-поиск для сбора актуальных данных.

ОБЯЗАТЕЛЬНО ищи через web_search:
1. Коэффициенты на матч — fonbet.ru, sports.ru, betting.ru, winline.ru  
2. Форму команд — результаты последних 10 матчей каждой
3. H2H — историю личных встреч за 2-3 года
4. Травмы и составы обеих команд (спортивные новости)
5. Турнирное положение, турнирная таблица

Отвечай ТОЛЬКО валидным JSON без markdown-обёртки и без \`\`\`json. Никаких пояснений вне JSON.
Если данных нет — заполни раздел экспертной оценкой, явно пометив это. Никогда не оставляй разделы пустыми.`;

  const userPrompt = `Сегодня: ${today}.
Матч: **${team1}** vs **${team2}**
Дата: ${dateInfo}${matchTime ? ', ' + matchTime + ' МСК' : ''}${league ? '\nЛига: ' + league : ''}
${oddsText ? 'Коэффициенты (уже известны):\n' + oddsText : 'Коэффициенты: найди на Фонбет и других букмекерах самостоятельно.'}

Выполни несколько поисков, затем верни JSON строго этой структуры:

{
  "motivation": "Полный текст (мин. 150 слов). Турнирное положение обеих команд, что даёт победа/ничья/поражение, психологические факторы. Markdown: ## ### **жирный** - списки.",

  "form": "Полный текст (мин. 200 слов). Результаты последних 10 матчей каждой команды в markdown-таблице (Дата | Соперник | Счёт | Р), динамика формы, голевая статистика. Где Р = В / Н / П.",

  "h2h": "Полный текст (мин. 150 слов). 5-7 последних встреч в markdown-таблице (Дата | Место | Счёт | Победитель). Тенденции, типичные счета, домашнее преимущество.",

  "lineups": "Полный текст (мин. 150 слов). Стартовые 11 каждой команды со схемой. Список травм и дисквалификаций с именами. Влияние отсутствий на тактику.",

  "tactics": "Полный текст (мин. 200 слов). Схема игры каждой команды, стиль (прессинг/контратаки/владение), сильные и слабые стороны атаки и защиты, стандартные положения, ключевые тактические дуэли.",

  "odds_analysis": {
    "odds_table": {
      "w1": "коэф П1 строкой например 1.85 или null",
      "draw": "коэф ничья или null",
      "w2": "коэф П2 или null",
      "over25": "тотал б2.5 или null",
      "under25": "тотал м2.5 или null",
      "handicap1": "фора П1 например -1(2.40) или null",
      "handicap2": "фора П2 например +1(1.55) или null",
      "w1_value": false,
      "draw_value": false,
      "w2_value": false,
      "over25_value": false,
      "under25_value": false,
      "handicap1_value": false,
      "handicap2_value": false
    },
    "analysis_text": "Полный текст (мин. 150 слов). Источник коэффициентов. Реальные вероятности по твоей оценке vs коэффициенты. Где value bet и почему. Расхождения с детальным объяснением."
  },

  "prediction": {
    "outcome_text": "Краткий вердикт, например: Победа Реала + Обе забьют",
    "reasoning": "2-3 предложения — главные аргументы",
    "main_bet": "Конкретная ставка например: П1 с форой -0.5",
    "main_odds": "например: 2.10",
    "main_reasoning": "Развёрнутое обоснование осн. ставки (мин. 120 слов) со ссылками на факты из анализа",
    "alt_bet": "Альтернативная ставка например: Тотал м2.5",
    "alt_odds": "например: 1.90",
    "alt_reasoning": "Обоснование альт. ставки (мин. 80 слов)",
    "stake": "число от 1 до 5 (% банка)",
    "risk": "Низкий или Средний или Высокий",
    "full_text": "Полный раздел прогноза (мин. 300 слов). Все аргументы, оба варианта ставок, % банка, обоснование уровня риска, итоговый совет."
  }
}`;

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 8000,
        system:     systemPrompt,
        tools:      [{ type: 'web_search_20250305', name: 'web_search' }],
        messages:   [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({ error: err.error?.message || `Upstream HTTP ${upstream.status}` });
    }

    const data = await upstream.json();

    const texts = (data.content || []).filter(b => b.type === 'text').map(b => b.text);
    if (!texts.length) return res.status(502).json({ error: 'Модель не вернула текст.' });

    let parsed = null;
    for (let i = texts.length - 1; i >= 0; i--) {
      const raw   = texts[i].trim();
      const clean = raw.replace(/^```json\s*/,'').replace(/^```\s*/,'').replace(/\s*```$/,'').trim();
      try { parsed = JSON.parse(clean); break; } catch(_) {}
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); break; } catch(_) {} }
    }

    if (!parsed) {
      parsed = {
        motivation: '', form: '', h2h: '', lineups: '', tactics: '',
        odds_analysis: { odds_table: {}, analysis_text: '' },
        prediction: {
          outcome_text: 'Анализ выполнен',
          reasoning: '',
          full_text: texts.join('\n\n'),
          main_bet: '', alt_bet: '', stake: '2', risk: 'Средний',
        },
      };
    }

    res.json({ ok: true, data: parsed });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// SPA fallback
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// 🔥 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: слушаем на 0.0.0.0 для Railway
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ TacticAI запущен на http://0.0.0.0:${PORT}`);
});