# AI Mindset Wild

Перед любой работой прочитать [MANDATORY_INSTRUCTIONS.md](MANDATORY_INSTRUCTIONS.md). Это связанная копия правил родителя; она обновляется автоматически вместе с parent pin. Обычная работа не разрешает менять структуру, порядок, ссылки или содержание верхнего общего меню, футера и обучения. Локальные изменения зеркала блокируют сборку.

Оригинальный сайт и его исходники. Рабочая папка остаётся на Яндекс.Диске; `.git` указывает на Git-метаданные в `~/Documents/Repos/aimindset-wild.git`. Другой редактируемой копии сайта нет.

## Источники

| Что менять | Источник |
| --- | --- |
| Структура главной | `src/page/index.html` |
| Подменю страницы | `src/site-sections.json` — необязательное, принадлежит странице; подписи Wild также редактируются в Google |
| Тексты главной | `src/content/main.json` — 370 обычных текстовых полей |
| CSS и поведение | `src/page/styles/`, `src/page/runtime/`; порядок — `source-manifest.json` |
| Верхнее общее меню, футер, обучение | Приватный [aim-web-platform](https://github.com/eppelas/aim-web-platform), `components/approved/` |
| Остальные четыре страницы | `tools/site-pages/` и страницы `non-profit/`, `ai-mindset-consulting/`, `oferta/`, `confpolicy/` |
| Облачный редактор | Существующий `src/page/runtime/inline-editor.js` и Google `aim-v5-publisher` |

`index.html` и `assets/site/site-shell.js` — результаты сборки. Не сохранять поверх них старый HTML из Google и не править их вместо исходников. Изменения меню, футера и обучения проходят через родительский `skills/shared-content/SKILL.md`; публичный exporter не создаёт ещё одну базу контента. Non-profit получает обучение из собранной главной через существующий iframe.

## Сборка и проверка

Нужны Python 3.12+, Node 22 и checkout родителя. `platform-dependency.json` закрепляет его ревизию. Локальный `AIM_PLATFORM_PATH` может указывать на существующую папку родителя.

```sh
npm ci --ignore-scripts
npm run check
npm run test:editor
python3 tools/source-build.py --platform /path/to/aim-web-platform
python3 tools/verify-source-build.py --platform /path/to/aim-web-platform
python3 tools/check-generated-source.py
node tools/verify-idle-schedulers.cjs
node tools/verify-idle-scenes.cjs
python3 -m unittest discover -s tools/release -p 'test_*.py'
python3 tools/site-pages/check-components.py
python3 tools/release/public_build.py --output /tmp/aim-wild-public
```

На этом Mac проверки могут использовать уже установленные PostCSS/Babel через `AIM_POSTCSS_PATH` и `AIM_BABEL_PARSER_PATH`; runtime браузера в репозиторий не устанавливается. Зависимости сборки фиксирует `package-lock.json`. Генератор сохраняет исходный порядок CSS/JS. `important-budget.json` содержит точный список оставшихся приоритетов: добавленные и забытые записи отклоняются проверкой.

Для обычного просмотра открыть `_ AIM Wild.app` в корне AIM Website. Вложенный `! Open AIM Wild.command` собирает публичный вариант, проверяет порт и возвращает адрес. Генерируемые preview-файлы хранятся во временной папке вне облака.

## Публикация

Исходники Wild хранятся в ветке `wild` репозитория [eppelas/aimindset-main](https://github.com/eppelas/aimindset-main/tree/wild). Ветка `main` содержит существующую Main; Pages workflow добавляет опубликованный Wild под `wild/` при сборке общего артефакта. Не пушить корень этой рабочей папки в удалённую `main`.

Non-profit использует JetBrains Mono ExtraBold. Trial-шрифт и отвергнутый отдельный OAuth-прототип сохранены в локальной резервной папке и исключены из исходного коммита и публичной сборки.

Публичный адрес Wild: [eppelas.github.io/aimindset-main/wild/](https://eppelas.github.io/aimindset-main/wild/). В релиз попадают только файлы из `release-manifest.json`, с SHA исходников и родителя. Редактор, операции записи, служебные файлы и резервные копии исключены. Расписание обращается к существующему Google API; waitlist сохраняет прежний обработчик.

Основная доставка выполняется GitHub Actions. `tools/release/publish-artifact.py` сохраняет дополнительный проверяемый путь публикации через Git data API; по умолчанию это dry-run. При конкурентном изменении `main` операция останавливается. Для отката создать новый коммит с выбранным прежним состоянием исходников и parent pin, затем повторить обычные проверки и выпуск.

`source-checks.yml` проверяет источник и сборку закреплённого приватного родителя. `wild-release.yml` после проверок обновляет существующий Google publisher и публикует Pages без редактора. Push в `wild` означает публикацию. Новый parent сначала переносится отдельным коммитом Wild вместе с pin и результатами сборки; выпуск всегда использует закреплённую в исходниках версию. Часовой запуск проверяет доставку актуального Wild. Точная пара сохраняется в release-manifest; одинаковая пара не пересобирается.

## Google и передача команде

Google использует прежний inline-редактор: «править» → пароль 0281 → изменить текст → «сохранить». Google-аккаунт и список редакторов не требуются. `google-save-sync.yml` примерно раз в пять минут переносит изменённые текстовые поля прямо в коммит Wild, затем явно запускает release. После сбоя доставки следующий запуск повторяет release того же коммита, не создавая дубль; активный выпуск не дублируется. PR не создаются. HTML/CSS/JS из Google не копируются в GitHub. Трёхстороннее сравнение и ревизии защищают от затёртых правок; меню, футер и обучение редактируются только в родителе через skill.

GitHub→Google работает через `tools/release/publish-google.py`, существующий `aim-v5-publisher` и объекты `wild/` существующего бакета. Доступ Actions короткоживущий (Workload Identity), постоянный Google-ключ не нужен. Старые файлы сохраняются в `wild/release-backups/`; журнал создаётся до записи. Неперенесённый Google-текст блокирует обратную публикацию. Одинаковые версии не создают цикл коммитов.

Настроены `AIM_PLATFORM_DEPLOY_KEY`, `AIM_GOOGLE_WIF_PROVIDER`, `AIM_GOOGLE_SERVICE_ACCOUNT`; рабочий флаг — `AIM_PLATFORM_INTEGRATION=enabled`. Последнюю фактическую доставку проверять по [Actions](https://github.com/eppelas/aimindset-main/actions) и [release-manifest](https://eppelas.github.io/aimindset-main/wild/release-manifest.json). GitHub вернул 403 на включение защиты приватной ветки. По решению пользователя личное размещение продолжается без Pro; для синхронизации и публикации он не нужен. Потребитель читает общий приватный источник через read-only deploy key. При переносе команда отдельно решает вопрос принудительных branch rules.

[Инструкция команде](https://github.com/eppelas/aim-web-platform/blob/main/docs/team-handoff.md) перечисляет репозитории, Google-ресурсы, перенос в организацию, права машинной публикации и откат. Технические архивы не входят в релиз.
