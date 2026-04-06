# yaml-processor

Приложение для редактирования, импорта и экспорта YAML-конфигураций процессов.

Основной модуль:

- `modules/configurator` — Spring Boot backend

Исходники frontend находятся в:

- `modules/frontend`

Frontend собирается Maven-ом автоматически и раздается через backend.

## Требования

- Java 17+
- Maven 3.9+
- Node.js 18+ и `npm`

## Быстрый старт

Из корня проекта:

```bash
mvn -pl modules/configurator spring-boot:run
```

После запуска приложение доступно по адресу:

```text
http://localhost:8080/
```

## Что происходит при запуске

Команда `mvn spring-boot:run` для модуля `configurator` автоматически:

- устанавливает frontend-зависимости через `npm ci`
- собирает frontend через `npm run build`
- копирует собранные файлы в статические ресурсы backend
- запускает Spring Boot приложение

## Основные URL

- UI: `http://localhost:8080/`
- GraphQL endpoint: `http://localhost:8080/graphql`
- GraphiQL: `http://localhost:8080/graphiql`
- H2 Console: `http://localhost:8080/h2-console`

## Сборка

Собрать приложение:

```bash
mvn -pl modules/configurator clean package
```

Результат сборки backend:

```text
modules/configurator/target/
```

Во время `package` frontend также собирается автоматически.

## Запуск собранного jar

После сборки:

```bash
java -jar modules/configurator/target/configurator-1.0.0.jar
```

## Использование

В интерфейсе доступны основные сценарии:

- создание нового процесса
- удаление процесса целиком вместе со всей вложенной конфигурацией
- импорт YAML
- экспорт YAML
- редактирование дерева процесса

Импорт и экспорт доступны в меню `Экспорт/импорт`.

Поддерживаются два режима импорта YAML:

- `new` — текущая схема
- `legacy` — старая схема

## Разработка frontend отдельно

Если нужен отдельный dev-сервер frontend:

```bash
cd modules/frontend
npm install
npm run dev
```

Vite будет проксировать запросы к backend на `http://localhost:8080`.

## Полезные замечания

- Если не нужно собирать frontend при Maven-запуске, можно использовать:

```bash
mvn -pl modules/configurator -Dskip.frontend=true spring-boot:run
```

- Для полноценной работы приложения backend должен быть запущен, даже если frontend стартует отдельно через Vite.
