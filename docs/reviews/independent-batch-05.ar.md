# المراجعة المستقلة — الدفعة 5: خمس مهارات من microsoft/skills

تاريخ المراجعة: 2026-10-05. تغطي هذه الدفعة **خمس مهارات فقط** من قائمة التوسعة التي كانت ما تزال بلا دليل independent-batch إضافي. السجل القابل للمعالجة آليًا والتفاصيل الدقيقة للبصمات موجودة في [independent-batch-05.json](independent-batch-05.json).

هذه مراجعة **AI-assisted** قرأت كل ملف موزع كاملًا وراجعت المصدر المثبت. ليست شهادة أمنية بشرية، وليست اختبار أداء، ونجاح التثبيت أو البناء لا يثبت أن المهارة تنجز المهمة جيدًا.

## ما تم التحقق منه

- المصدر المثبت هو `microsoft/skills@84d8eaa8ae95930f55cdceb3e27196c795dab038`. الشجرة recursive غير truncated.
- كل واحدة من المهارات الخمس تحتوي في المصدر على `SKILL.md` واحد فقط بوضع `100644`. تطابقت Git blob والـbytes مع النسخة الموزعة، و`LICENSE.txt` المرفق هو نفس blob لترخيص الجذر MIT (1140 bytes).
- فُحصت مسارات الأسلاف بحثًا عن `LICENSE/COPYING/NOTICE` ولم يوجد override على مسار أي مهارة. قُرئ ترخيص MIT الجذري، ولم يظهر إشعار طرف ثالث داخل ملفات المهارات.
- قورنت سجلات review والـmaterialized manifests مع inventory وSHA-256 وGit blob/mode والمسار والcommit المثبت.
- فُصلت تعليمات الوكيل الفعلية عن أمثلة كود التطبيق.

## القرارات

| المهارة | القرار | أهم السلوك/الدليل |
| --- | --- | --- |
| `microsoft/microsoft-docs` | release / يبقى eligible | يستخدم Microsoft Learn MCP. عند غيابه، الأسطر 63–70 تطلب `npx @microsoft/learn-cli` أو global npm install غير مثبت الإصدار. هذا network/package execution حقيقي، لكنه fallback رسمي للقراءة فقط؛ يبقى medium. |
| `microsoft/wiki-vitepress` | release / يبقى eligible | ينشئ `wiki-site/` ويكتب config/theme/CSS ويعيد معالجة Markdown، ثم الأسطر 141–142 تشغل `npm install && npm run docs:build`. الإشارة إلى `/deep-wiki:build` اختيارية وليست dependency لازمة لتشغيل المهارة standalone. |
| `microsoft/azure-keyvault-secrets-rust` | release / يبقى eligible | `cargo add` تعليمات فعلية. أمثلة التطبيق تستخدم هوية المطور وتعرض set/get/update/delete. السطر 61 والسطر 138 يطبعان **قيمة secret**؛ هذه ممارسة logging غير مناسبة للـproduction ويجب عدم نسخها حرفيًا، لكنها sample application code وليست أمرًا للوكيل لقراءة/تسريب secret موجود أثناء المراجعة. السطر 117 يعرض delete_secret. |
| `microsoft/azure-identity-rust` | release / يبقى eligible | `cargo add` فعلي، والأسطر 76–79 تطلب `az login` أو `azd auth login` فتغيّر حالة المصادقة المحلية وتفتح network login. مثال DeveloperToolsCredential يطبع قيمة Key Vault secret في الأسطر 68–69؛ ملاحظة أمنية في sample code وليست secret مشحونة أو أمر إفشاء مستقل. |
| `microsoft/azure-cosmos-rust` | release / يبقى eligible | `cargo add` فعلي. أمثلة التطبيق تستخدم DeveloperToolsCredential وتعرض create/read/replace/delete وpatch؛ الأسطر 94–109 تشمل حذف item. لا يوجد أمر للوكيل أن ينفذ العملية على حساب Azure أثناء استخدام المهارة، ولا يوجد database/container delete في الملف. |

## لماذا لم تتغير release states

لم نجد blocker مثبتًا في الترخيص أو dependency أو الأمن لهذه الخمس. المخاطر المهمة مرئية ومحدودة:

- أوامر package/auth الفعلية مصنفة medium ومتصلة مباشرة بالوظيفة المعلنة.
- طباعة secrets وعمليات Azure destructive موجودة في **أمثلة التطبيق** وليست خطوات تشغيل خفية ينفذها الوكيل تلقائيًا.
- لا توجد credentials حقيقية مشحونة، ولا ملفات sibling مطلوبة ومفقودة، ولا license override أو third-party notice غير محمول.

لذلك لا يوجد مبرر لتغيير catalog/lockfile/materialized skill content في هذه الدفعة.

## ما لم نختبره

لم نسجل الدخول إلى Azure، ولم نشغّل Key Vault أو Cosmos، ولم ننشئ/نعدّل/نحذف موارد سحابية، ولم نشغّل أمثلة Rust، ولم ننفذ `cargo add` أو `npm install` أو mslearn كاختبار أداء. كذلك لم نقِس جودة نتائج المهارة مقابل baseline بلا مهارة.

## أثر الدفعة على مصفوفة الـ139

أُعيد حساب الأعداد من المصفوفة بعد ربط هذه الخمس بالدفعة 5. لا تتغير حالات الإصدار: eligible/held تبقى كما هي، لكن عدد المهارات eligible التي ما تزال بلا independent-batch إضافي ينخفض بخمس.
