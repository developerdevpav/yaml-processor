# Process Topology Frontend

React + TypeScript frontend для редактирования доменной модели процесса через GraphQL backend проекта.

## Структура

- `src/app` — корневой React-компонент приложения.
- `src/features/process-configurator` — экран редактирования процессной конфигурации и его бизнес-логика.
  - `api/graphqlDocuments.ts` — GraphQL queries/mutations.
  - `components/` — drawer/sidebar/modal-компоненты feature.
  - `components/node-editor/` — редактор узлов, разбитый на секции process/subprocess, stage, result, reverse и reverse output.
  - `model/` — helper'ы состояния дерева и справочника кодов процесса.
- `src/components` — переиспользуемые UI-компоненты, topology, панели и модальные окна.
  - `components/topology/` разбит на orchestration, ReactFlow nodes/controls, YAML editor и structure model.
- `src/types` — доменные TypeScript-типы для процесса, стадий, результатов и reverse output.
- `src/utils` — маленькие общие утилиты форматирования и className-композиции.

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
cd modules/configurator
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
- Если backend-схема будет изменена, GraphQL-фрагменты в `src/features/process-configurator/ProcessConfiguratorPage.tsx` нужно синхронизировать с новыми именами полей.
- Основной сценарий сейчас покрывает создание процесса и наращивание дерева до `stage`.
