# 🚀 Развёртывание Тактик AI

## Структура проекта
```
tacticai/
├── server.js          ← Express-сервер (бэкенд)
├── package.json       ← Зависимости
├── .env.example       ← Шаблон переменных окружения
├── .gitignore
└── public/
    └── index.html     ← Фронтенд
```

---

## Вариант А — Railway (рекомендуется, бесплатно)

### 1. Подготовь репозиторий
```bash
cd tacticai
git init
git add .
git commit -m "init"
```

### 2. Создай репозиторий на GitHub
- Зайди на github.com → New repository → назови `tacticai`
- Скопируй HTTPS-ссылку

```bash
git remote add origin https://github.com/ТВОЙ_НИК/tacticai.git
git push -u origin main
```

### 3. Деплой на Railway
1. Зайди на **railway.app** → Log in with GitHub
2. **New Project** → **Deploy from GitHub repo** → выбери `tacticai`
3. Railway автоматически определит Node.js и задеплоит
4. В разделе **Variables** добавь:
   ```
   ANTHROPIC_API_KEY = sk-ant-ТВОЙ_КЛЮЧ
   ```
5. Во вкладке **Settings → Networking** нажми **Generate Domain**
6. Готово! Сайт доступен по ссылке типа `https://tacticai-production.up.railway.app`

---

## Вариант Б — Render (тоже бесплатно)

1. Зайди на **render.com** → New → **Web Service**
2. Подключи GitHub репозиторий
3. Настройки:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Environment:** Node
4. В **Environment Variables** добавь `ANTHROPIC_API_KEY`
5. Нажми **Create Web Service**

---

## Получение API-ключа Anthropic

1. Зайди на **console.anthropic.com**
2. API Keys → **Create Key**
3. Скопируй ключ (начинается с `sk-ant-`)
4. Вставь в переменную окружения на Railway/Render

---

## Локальный запуск (для теста)

```bash
cd tacticai
cp .env.example .env
# Вставь ключ в .env

npm install
npm start
# Открой http://localhost:3000
```

---

## Примечания

- Сайт делает до 10 запросов/час с одного IP (защита от злоупотреблений)
- Каждый анализ занимает 30–60 секунд (модель выполняет поиск в интернете)
- Railway даёт $5 кредита в месяц бесплатно — при 5 запросах в день хватит с запасом
- Render бесплатен, но засыпает через 15 мин простоя (первый запрос медленнее)
