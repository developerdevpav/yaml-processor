# yaml-processor

Приложение для редактирования, импорта и экспорта YAML-конфигураций процессов.

Основной модуль:

- `modules/configurator` — Spring Boot backend

Исходники frontend находятся в:

- `modules/frontend`

Frontend можно собрать отдельным Maven-профилем и раздавать через backend.

## Требования

- Java 17+
- Maven 3.9+
- Node.js 18+ и `npm`

## Быстрый старт

Из корня проекта:

```bash
mvn -pl modules/configurator -Pwith-frontend spring-boot:run
```

После запуска приложение доступно по адресу:

```text
http://localhost:8080/
```

## Что происходит при запуске

Команда `mvn -Pwith-frontend spring-boot:run` для модуля `configurator`:

- включает Maven-профиль `with-frontend`
- выполняет `npm ci` в `modules/frontend`
- выполняет `npm run build`
- копирует собранный frontend в статические ресурсы backend
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

Собрать backend вместе с frontend:

```bash
mvn -pl modules/configurator -Pwith-frontend clean package
```

Собрать frontend и скопировать его в `modules/configurator/src/main/resources/static`:

```bash
mvn -pl modules/configurator -Pfrontend-to-resources process-resources
```

Результат сборки backend:

```text
modules/configurator/target/
```

Без профиля `with-frontend` собирается только backend.

## Запуск собранного jar

После сборки:

```bash
java -jar modules/configurator/target/configurator-1.0.0.jar
```

Если jar собран с профилем `with-frontend`, UI будет доступен через backend на `http://localhost:8080/`.

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

- Профиль `with-frontend` собирает frontend и встраивает его в backend build output.
- Профиль `frontend-to-resources` копирует frontend прямо в `src/main/resources/static`. Это удобно для ручной фиксации собранного UI в репозитории.
- Если на машине нет `npm`, собирайте jar с профилем `with-frontend` один раз на машине, где `npm` есть, и переносите на сервер уже готовый jar.
- Для полноценной работы приложения backend должен быть запущен, даже если frontend стартует отдельно через Vite.
