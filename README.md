# Games of Senses 🎮

**Games of Senses** — платформа для создания и проведения онлайн-игр с видео-трансляцией, чатом в реальном времени и интерактивными элементами.

## 📋 Описание проекта

Games of Senses позволяет пользователям:
- **Создавать и проводить игры** с поддержкой видео-конференции через LiveKit
- **Смотреть игры** в реальном времени с чатом и реакциями
- **Делиться постами и комментариями** в сообществе
- **Записывать игровые сессии** с автоматической загрузкой на Google Drive
- **Управлять игровыми элементами**: голосования, голосовые чаты, разбиение на подгруппы (breakout rooms)

## 🏗️ Архитектура

### Backend (`/back`)
- **Технология**: Node.js + Express + TypeScript
- **База данных**: MongoDB
- **Real-time**: Socket.IO
- **Видео**: LiveKit (управление комнатами и токенами)
- **Аутентификация**: JWT + Google OAuth
- **Хранилище**: Google Drive (записи), Cloudinary (изображения)
- **Email**: SendGrid + Nodemailer

### Frontend (`/front`)
- **Технология**: React 18 + TypeScript + Vite
- **Стили**: TailwindCSS
- **Real-time**: Socket.IO Client
- **Видео**: LiveKit Components React
- **Маршрутизация**: React Router v6
- **i18n**: i18next для многоязычности
- **Аутентификация**: Google OAuth

## 🚀 Быстрый старт

### Требования
- Node.js 18+ (рекомендуется 20+)
- npm или yarn
- MongoDB (облачный или локальный)
- Переменные окружения (см. ниже)

### Установка и запуск

#### 1. Клонирование и установка зависимостей
```bash
# Клонировать репозиторий
git clone <repository-url>
cd game-platform

# Backend
cd back
npm install

# Frontend (в новом терминале)
cd front
npm install
```

#### 2. Конфигурация переменных окружения

**Backend** (`back/.env`):
```bash
# Основное
PORT=5000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/game

# JWT
JWT_SECRET=your-secret-key-min-32-chars

# Frontend URL
CLIENT_URL=http://localhost:3000

# Email (SendGrid)
SENDGRID_API_KEY=your-key
SENDGRID_FROM=noreply@example.com

# Email (Nodemailer/Gmail)
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# LiveKit (видео-конференция)
LIVEKIT_URL=https://your-livekit-instance.com
LIVEKIT_API_KEY=your-key
LIVEKIT_API_SECRET=your-secret

# Google Drive (для сохранения записей)
GOOGLE_SERVICE_ACCOUNT_JSON=base64-encoded-json
GOOGLE_DRIVE_FOLDER_ID=folder-id

# Cloudinary (загрузка изображений)
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret
```

**Frontend** (`front/.env`):
```bash
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_API_URL=http://localhost:5000
```

Скопируйте `back/.env.example` в `back/.env` для быстрого старта с заглушками:
```bash
cd back
cp .env.example .env
```

#### 3. Запуск в режиме разработки

**Terminal 1 — Backend:**
```bash
cd back
npm run dev
# Запустится на http://localhost:5000
# Используется nodemon для автоперезагрузки при изменении файлов
```

**Terminal 2 — Frontend:**
```bash
cd front
npm run dev
# Запустится на http://localhost:5173 (или другой доступный порт)
```

Откройте **http://localhost:5173** в браузере.

### 4. Сборка для продакшена

**Backend:**
```bash
cd back
npm run build        # Компилирует TypeScript → JavaScript (dist/)
npm start            # Запускает скомпилированное приложение
```

**Frontend:**
```bash
cd front
npm run build        # Собирает Vite bundle в dist/
npm run preview      # Предпросмотр собранного приложения локально
```

## 📁 Структура проекта

### Backend структура
```
back/
├── src/
│   ├── app.ts                    # Главный файл приложения (Express + Socket.IO)
│   ├── config/
│   │   └── db.ts                 # Подключение MongoDB
│   ├── models/                   # Mongoose schemas
│   │   ├── User.ts               # Пользователи
│   │   ├── Game.ts               # Игры
│   │   ├── Recording.ts          # Записи сессий
│   │   ├── Post.ts               # Посты в сообществе
│   │   ├── Comment.ts            # Комментарии
│   │   ├── GameMessage.ts        # Сообщения в чате игры
│   │   └── GameLike.ts           # Лайки сообщений
│   ├── routes/                   # API маршруты
│   │   ├── auth.ts               # Логин, регистрация, выход
│   │   ├── games.ts              # CRUD игр
│   │   ├── livekit.ts            # Генерация токенов LiveKit
│   │   ├── recordings.ts         # Управление записями
│   │   ├── upload.ts             # Загрузка файлов (Cloudinary)
│   │   └── community.ts          # Посты и комментарии
│   ├── socket/                   # Socket.IO обработчики
│   │   ├── gameRoom.ts           # Логика игровой комнаты (чат, события)
│   │   ├── community.ts          # Real-time события в сообществе
│   │   └── types.ts              # TypeScript типы для Socket.IO
│   ├── middleware/
│   │   └── authMiddleware.ts     # JWT проверка
│   ├── services/
│   │   ├── email.ts              # SendGrid + Nodemailer
│   │   └── googleDrive.ts        # Загрузка/удаление файлов
│   └── ...
├── dist/                         # Скомпилированный JavaScript (после npm run build)
├── package.json
├── tsconfig.json
└── .env.example
```

### Frontend структура
```
front/
├── src/
│   ├── App.tsx                   # Главный компонент (маршруты)
│   ├── main.tsx                  # Точка входа React
│   ├── components/
│   │   ├── pages/                # Страницы приложения
│   │   │   ├── HomePage.tsx       # Главная
│   │   │   ├── AuthPage.tsx       # Логин/регистрация
│   │   │   ├── GamePage.tsx       # Информация об игре
│   │   │   ├── CreateGamePage.tsx # Создание/редактирование игры
│   │   │   ├── OurGamesPage.tsx   # Список игр
│   │   │   ├── GameRoomPage.tsx   # Игровая комната (видео + чат)
│   │   │   ├── ObserverPage.tsx   # Наблюдение за игрой
│   │   │   └── CommunityPage.tsx  # Лента сообщества
│   │   ├── gameroom/             # Компоненты для игровой комнаты
│   │   │   ├── GridView.tsx       # Сетка видео участников
│   │   │   ├── SpeakerView.tsx    # Вид основного спикера
│   │   │   ├── ChatPanel.tsx      # Чат
│   │   │   ├── ModPanel.tsx       # Панель модератора
│   │   │   ├── VotingPanel.tsx    # Голосование
│   │   │   ├── VotingModal.tsx    # Модаль голосования
│   │   │   ├── BreakoutModal.tsx  # Разбиение на подгруппы
│   │   │   ├── TimerModal.tsx     # Таймер
│   │   │   ├── CoinModal.tsx      # Подбрасывание монеты
│   │   │   ├── ObserverView.tsx   # Вид наблюдателя
│   │   │   ├── PreJoinScreen.tsx  # Экран перед присоединением
│   │   │   └── ...
│   │   ├── layout/               # Лайаут компоненты
│   │   │   ├── Header.tsx        # Заголовок
│   │   │   ├── Footer.tsx        # Подвал
│   │   │   └── MobileBottomNav.tsx
│   │   └── minicomponents/       # Переиспользуемые компоненты
│   │       ├── Button.tsx
│   │       ├── InputField.tsx
│   │       ├── Modal.tsx
│   │       └── ...
│   ├── context/                  # React Context
│   │   ├── AuthContext.tsx       # Аутентификация, пользователь
│   │   └── ThemeContext.tsx      # Тема оформления
│   └── ...
├── dist/                         # Собранное приложение (после npm run build)
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── .env.example
```

## 🔌 API маршруты

### Аутентификация
- `POST /api/auth/register` — Регистрация
- `POST /api/auth/login` — Логин (email + password)
- `POST /api/auth/logout` — Выход
- `POST /api/auth/google` — Google OAuth логин

### Игры
- `GET /api/games` — Список всех игр
- `GET /api/games/:id` — Информация об игре
- `POST /api/games` — Создать игру
- `PUT /api/games/:id` — Обновить игру
- `DELETE /api/games/:id` — Удалить игру
- `POST /api/games/:id/join` — Присоединиться к игре

### LiveKit (видео)
- `POST /api/livekit/token` — Получить токен для подключения

### Записи
- `GET /api/recordings` — Список записей пользователя
- `DELETE /api/recordings/:id` — Удалить запись

### Загрузка файлов
- `POST /api/upload` — Загрузить изображение на Cloudinary

### Сообщество
- `GET /api/community/posts` — Список постов
- `POST /api/community/posts` — Создать пост
- `POST /api/community/posts/:id/comments` — Добавить комментарий
- `POST /api/community/posts/:id/like` — Лайк поста

## 🔌 WebSocket события (Socket.IO)

### Игровая комната (`gr:` prefix)
- `gr:join` — Присоединиться к комнате
- `gr:leave` — Выйти из комнаты
- `gr:message` — Отправить сообщение в чат
- `gr:reaction` — Отправить реакцию
- `gr:vote` — Голосовать
- `gr:breakout` — Создать подгруппу
- `gr:timer` — Запустить таймер
- `gr:coin` — Подбросить монету
- `gr:end` — Завершить игру

### Сообщество (`community:` prefix)
- `community:post:new` — Новый пост
- `community:comment:new` — Новый комментарий
- `community:like:toggle` — Лайк/дизлайк

## 🔐 Аутентификация и авторизация

- **JWT токены** хранятся в localStorage на фронте
- **Socket.IO** проверяет токен при подключении (опционально)
- **Protected routes** требуют JWT в заголовке `Authorization: Bearer <token>`
- **Google OAuth** используется для быстрой регистрации/логина
- **Rate limiting** применяется к `/api/auth/login` и `/api/auth/register` (100 запросов за 15 минут)

## 📊 База данных (MongoDB)

### Основные коллекции
- **users** — Пользователи (email, пароль, профиль)
- **games** — Игры (название, описание, создатель, статус)
- **recordings** — Записи (видео, статус, expiry, Google Drive link)
- **posts** — Посты в сообществе (текст, автор, дата)
- **comments** — Комментарии (текст, пост, автор)
- **gamemessages** — Сообщения в чате игры (текст, игра, автор)
- **gamelikes** — Лайки (сообщение, автор)

## 🛠️ Развёртывание

### На Render.com (рекомендуется)
1. Создайте Web Services для backend и frontend
2. Укажите start scripts из package.json
3. Добавьте переменные окружения
4. Привяжите MongoDB Atlas

### На Vercel (frontend только)
```bash
# Frontend автоматически собирается при git push
# Переменные окружения добавьте в Project Settings
```

### На собственном сервере
```bash
# Backend
npm run build
npm start

# Frontend
npm run build
# Раздавайте dist/ через nginx/apache
```

## 📝 Разработка

### Скрипты
```bash
# Backend
npm run dev      # Запуск в режиме разработки с nodemon
npm run build    # Компилирование TypeScript
npm start        # Запуск скомпилированного приложения

# Frontend
npm run dev      # Vite dev server
npm run build    # Сборка для продакшена
npm run preview  # Предпросмотр собранной версии
```

### Соглашения
- **TypeScript everywhere** — Весь код должен быть типизирован
- **Component-driven development** — Компоненты маленькие и многоразовые
- **Socket.IO namespaces** — `gr:*` для игр, `community:*` для сообщества
- **Error handling** — Все async операции должны иметь try-catch
- **Environment variables** — Все конфиги через .env

## 🐛 Известные проблемы и TODO

- [ ] Тесты (unit, integration)
- [ ] Error boundaries в React
- [ ] Кэширование на фронте (Redux, Zustand)
- [ ] Offline режим
- [ ] Push notifications
- [ ] Analytics

## 📞 Контакты и поддержка

Если у вас есть вопросы по проекту, обратитесь к основному разработчику.

## 📄 Лицензия

ISC

---

**Версия**: 1.0.0  
**Последнее обновление**: 2026-08-30
