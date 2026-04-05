# Process Topology Frontend

React frontend для редактирования доменной модели процесса через GraphQL backend проекта.

## Что есть сейчас

- создание нового `ProcessConfig` с корневым `Process`
- визуализация дерева `Process -> Subprocess -> Stage`
- редактирование выбранного узла справа
- добавление `subprocess` под процесс
- добавление `stage` под subprocess
- сохранение через существующий `/graphql`

## Запуск

1. Запустить backend:

```bash
cd modules/digital-credit-process-configurator
mvn spring-boot:run
```

2. Установить зависимости фронта:

```bash
cd modules/frontend
npm install
```

3. Запустить dev server:

```bash
npm run dev
```

Vite проксирует `/graphql` на `http://localhost:8080`.

## Ограничения текущей версии

- UI работает поверх автогенерируемой GraphQL-схемы JPA.
- Для сохранения существующих вложенных данных клиент сериализует весь хвост домена `Configurator -> Result -> Reverse -> ReverseOutput`.
- Если backend-схема будет изменена, GraphQL-фрагменты в `src/App.jsx` нужно синхронизировать с новыми именами полей.
- Основной сценарий сейчас покрывает создание процесса и наращивание дерева до `stage`.
