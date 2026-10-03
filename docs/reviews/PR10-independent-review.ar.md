# مراجعة مستقلة لـ PR #10

التاريخ: 2026-10-03. الحكم على النسخة الأصلية: **يحتاج إصلاحًا**.

النسخة المراجعة: `8d2b453787f00e640fc064cb9b2422550da5deef`، مقابل `main` عند `dc8b726bdc00f1ee92e58e2491a862fb1849c414`. لم يُدمج PR #9 أو PR #10. أُجريت المراجعة والإصلاح في worktree منفصلة على `review/pr10-independent`، وبقي الفرع المحلي `feat/skill-behavior-evaluations` وملفاه المحليان `.pnpm-store/` و`LOCAL-REVIEW.md` دون تعديل.

أرقام الأسطر أدناه تخص نسخة PR #10 الأصلية، وليست أرقامها بعد الإصلاح. هذه مراجعة مستقلة عن مؤلف التغيير، بمساعدة AI؛ ليست مراجعة بشرية للأداء أو شهادة أمنية.

## العيوب المؤكدة، حسب الخطورة

### 1. P1 — عرض ملفات لم تصدر، واتباع رابط جذر المهارة

الموضع: [packages/server/src/index.mjs:57](https://github.com/AxiomNode-lab/AI-Skills-Hub/blob/8d2b453787f00e640fc064cb9b2422550da5deef/packages/server/src/index.mjs#L57)، والقراءة في السطر 72.

إعادة الإنتاج: انسخ حزمة `microsoft/wiki-qa` إلى مجلد اختبار، ومرر نسخة سجلها إلى `createCatalog` مع `materialized_root` يشير إلى النسخة. أضف `unreviewed-secret.txt` ثم اطلب `skillshub://skills/microsoft/wiki-qa/unreviewed-secret.txt`. أعادت النسخة الأصلية النص `PRIVATE LOCAL CONTENT`. إنشاء junction لمجلد الحزمة ووضعه بدل جذرها أبقى `skill_md` متاحًا. لم يُنشأ أي ملف حساس حقيقي في التجربة.

الأثر: يكفي علم `eligible` لعرض أي ملف عادي موجود داخل الحزمة، حتى لو أضيف بعد المراجعة أو تغير محتواه. فحص `Dirent` يمنع الروابط الموجودة داخل المجلد، لكنه لا يفحص الجذر أو المجلدات العليا. لا يوجد تجاوز مباشر عبر `../` في URI؛ مسار الخلل هو محتوى القرص غير المطابق أو الجذر المرتبط.

الإصلاح المنفذ: قصر المسارات على Hub، وفحص كل مكون تحت جذره ضد symlink/junction، والتحقق من manifest والمراجعة المرتبطة وبصمتها، وإعادة تطبيق بوابة المراجعة وقائمة الملفات الكاملة، ثم إعادة التحقق من بصمات البايتات التي ستُعاد فعلًا. أي اختلاف يحجب محتوى الحزمة كلها مع إبقاء بيانات الفهرس. تغطية الرفض في `tests/server-security.test.mjs` تشمل الملفات الزائدة والمتغيرة والناقصة، والمراجعة المعدلة، والجذر والأسلاف المرتبطة، والمسارات الخارجية، والمهارات المحظورة والمعلقة.

### 2. P1 — محلل frontmatter يمحو تصريح ترخيص متعارض

الموضع: [packages/core/src/index.mjs:128](https://github.com/AxiomNode-lab/AI-Skills-Hub/blob/8d2b453787f00e640fc064cb9b2422550da5deef/packages/core/src/index.mjs#L128)، مع [packages/materializer/src/reviewed.mjs:107](https://github.com/AxiomNode-lab/AI-Skills-Hub/blob/8d2b453787f00e640fc064cb9b2422550da5deef/packages/materializer/src/reviewed.mjs#L107).

إعادة الإنتاج: استخدم frontmatter التالية في نسخة اختبار لمهارة MIT، وحدّث بصمات ملف الاختبار وسجله لتعكس البايتات الجديدة:

```yaml
---
name: wiki-qa
description: demo
license:
  spdx: Proprietary
---
```

أعاد المحلل الأصلي `name` و`description` فقط، وأعادت `verifyReviewedDirectory` الحالة `verified`. كذلك يتجاهل المفتاح الصحيح في YAML بصيغة `"license": Proprietary`، ويسمح بمفاتيح مكررة. وهناك فقد لمعنى `|+` وبعض صيغ indentation/quoting.

الأثر: تصريح غير مدعوم يصبح مساويًا لغياب التصريح، فتُقبل تغطية MIT من الجذر خطأ. ليست هذه حالة موجودة في المهارات الـ24 الحالية؛ إنها ثغرة قابلة للتكرار في البوابة التي ستراجع الإضافات التالية.

الإصلاح المنفذ: استخدام `yaml@2.9.1` مقفل الإصدار، وتحليل YAML 1.2؛ رفض الأخطاء والتحذيرات والمفاتيح المكررة والـaliases/anchors/merge/custom tags. يجب أن تكون `name/description/license` سلاسل غير فارغة عند وجودها. اختبارات في `core.test.mjs` و`draft-review.test.mjs` و`reviewed-release.test.mjs` تثبت رفض الحالة عبر المحلل وبوابة الإصدار نفسها، وحفظ معنى القيم الصحيحة.

### 3. P2 — HTTP يقبل Origin خارجيًا ويتيح قراءة الاستجابة عبر CORS

الموضع: [packages/server/src/index.mjs:236](https://github.com/AxiomNode-lab/AI-Skills-Hub/blob/8d2b453787f00e640fc064cb9b2422550da5deef/packages/server/src/index.mjs#L236)، ومدخل الخادم في السطر 289.

إعادة الإنتاج: شغّل الخادم محليًا وأرسل `POST /mcp` مع `Origin: https://attacker.example` و`Content-Type: text/plain` وجسم JSON-RPC لـ`resources/list`. أعاد الخادم 200 و`access-control-allow-origin: *`.

الأثر: الاستماع الافتراضي الصحيح على `127.0.0.1` لا يغني عن التحقق من Origin/Host. يسمح التطبيق بطلبات مواقع خارجية وقراءة محتواه عند سماح المتصفح بالوصول المحلي؛ وتتفاقم النتيجة مع العيب الأول أو فهرس Hub خاص. لا تدعي التجربة اختبار جميع سياسات المتصفحات. تنص [مواصفة MCP للنقل](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports) على وجوب فحص Origin للحماية من DNS rebinding.

الإصلاح المنفذ: رفض Host غير المطابق لعنوان الاستماع/أسماء loopback ومنفذه، ورفض Origin الخارجي و`null`، وإزالة CORS العام، واشتراط JSON. غير المتصفح يستطيع حذف Origin. حد الاستماع الافتراضي لم يتغير. تحديث API/MCP يوثق أن الخادم محلي وغير مصادق، وأن أسماء reverse-proxy المخصصة ليست ضمن السياسة الحالية.

### 4. P2 — التعرف على MIT يقبل نصًا ناقصًا أو شروطًا إضافية

الموضع: [packages/materializer/src/reviewed.mjs:17](https://github.com/AxiomNode-lab/AI-Skills-Hub/blob/8d2b453787f00e640fc064cb9b2422550da5deef/packages/materializer/src/reviewed.mjs#L17).

إعادة الإنتاج: مرر إلى `detectLicense` نص MIT بعد حذف فقرة `THE SOFTWARE IS PROVIDED` وما يليها، أو أضف `Non-commercial use only.` إلى MIT الكامل. الشروط الثلاثة الأصلية ما زالت تصنفه MIT. الاختبار الأصلي نفسه كان يستخدم عينة MIT مختصرة غير كاملة.

الأثر: التعرف الآلي لا يحقق شرط «النص الكامل» في السياسة، ويمكن أن يقبل منحًا أضيق من MIT. لم أجد ذلك في التراخيص الفعلية للمهارات الـ24.

الإصلاح المنفذ: مطابقة نص المنح والإشعار وإخلاء المسؤولية كاملًا بعد التطبيع المحدود للمسافات والنقطة الختامية، مع سطر copyright. الأنواع غير المعروفة تحتاج مراجعة منفصلة. استبدال fixture المختصرة بنص كامل وإضافة اختباري الرفض.

### 5. P2 — مدخلات MCP غير الصحيحة تتحول إلى 500 أو تُقبل بمعنى مختلف

الموضع: [packages/server/src/index.mjs:189](https://github.com/AxiomNode-lab/AI-Skills-Hub/blob/8d2b453787f00e640fc064cb9b2422550da5deef/packages/server/src/index.mjs#L189)، والسطر 208، وحد الجسم في السطر 251.

إعادة الإنتاج: `initialize` مع `params: null` أعاد HTTP 500 ورسالة JavaScript الداخلية. `search_skills` مع `limit: -1` و`installable_only: "false"` لم يُرفض كخطأ مدخلات، رغم مخالفته inputSchema؛ والسلسلة `"false"` تُفسر كقيمة صادقة. الهروب `%ZZ` يؤدي أيضًا إلى خطأ داخلي. عند تجاوز حد الجسم كان الكود يدمر socket بدل ضمان استجابة رفض HTTP.

الأثر: لا تُطبق العقود المعلنة، ويختلف معنى البحث بصمت، ويتعذر على العميل تمييز الطلب الخاطئ من عطل الخادم.

الإصلاح المنفذ: تحقق صريح من هيكل params وأنواع الوسائط وحدودها واسم agent، والتحقق من pagination والهروب وإصدار البروتوكول وContent-Type؛ الرد بـ400/415 أو خطأ JSON-RPC/أداة مناسب، و413 مع التخلص من البيانات الزائدة دون تخزينها. اختبار رفض فعلي عبر HTTP وMCP، دون كشف رسائل أخطاء داخلية.

## الترخيص والمصدر: نتيجة كل مهارة جديدة

الملف [pr10-source-evidence.json](pr10-source-evidence.json) يسجل لكل مهارة **المستودع والمسار الكامل ونسخة Git ذات 40 خانة**، ولكل ملف مسار المصدر وGit mode وGit blob وSHA-256 ونتيجة مطابقة البايتات. ويسجل ملفات الترخيص/الإشعار الواقعة في الجذر والأسلاف وداخل المهارة مع بصماتها. لا يتضمن نسخ محتوى أطراف ثالثة.

تمت مطابقة 24 شجرة مهارة غير مبتورة، و61 ملفًا محليًا، مع البايتات الخام عند النسخ التالية:

| المصدر | النسخة الثابتة | دليل التغطية |
| --- | --- | --- |
| anthropics/skills | `8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4` | LICENSE.txt داخل كل مهارة، وإحالة frontmatter صريحة، Apache-2.0 |
| microsoft/skills | `84d8eaa8ae95930f55cdceb3e27196c795dab038` | LICENSE في الجذر، MIT كامل، بلا override في المسار أو الحزمة |
| obra/superpowers | `8ca22dba9a94f28898bbce59f2537ff4d87c747d` | LICENSE في الجذر، MIT كامل، بلا override في المسار أو الحزمة |
| K-Dense-AI/scientific-agent-skills | `154988403bb5a18e9d3c0ce4e6d5e2e4b184a298` | LICENSE.md في الجذر مع تصريح MIT داخل المهارة، بلا override |

عدد الملفات يتضمن LICENSE.txt المرفق في حزم MIT. «كافٍ» هنا يعني كفاية دليل التوزيع وفق سياسة المستودع، ولا يعني نجاح المهارة عمليًا أو إثبات ملكية كل عبارة بصورة مستقلة.

| المهارة | الملفات | نتيجة دليل الترخيص |
| --- | ---: | --- |
| anthropics/academy-guide | 2 | كافٍ؛ Apache محلي |
| anthropics/discernment-nudge | 2 | كافٍ؛ Apache محلي |
| kdense/consciousness-council | 3 | كافٍ؛ MIT جذر وتصريح محلي |
| kdense/dhdna-profiler | 3 | كافٍ؛ MIT جذر وتصريح محلي |
| microsoft/azure-communication-callingserver-java | 3 | كافٍ؛ MIT |
| microsoft/azure-monitor-opentelemetry-exporter-java | 3 | كافٍ؛ MIT |
| microsoft/github-issue-creator | 2 | كافٍ؛ MIT |
| microsoft/install-atk | 2 | كافٍ؛ MIT |
| microsoft/microsoft-azure-webjobs-extensions-authentication-events-dotnet | 2 | كافٍ؛ MIT |
| microsoft/wiki-ado-convert | 2 | كافٍ؛ MIT |
| microsoft/wiki-architect | 2 | كافٍ؛ MIT |
| microsoft/wiki-changelog | 2 | كافٍ؛ MIT |
| microsoft/wiki-llms-txt | 2 | كافٍ؛ MIT |
| microsoft/wiki-onboarding | 2 | كافٍ؛ MIT |
| microsoft/wiki-page-writer | 2 | كافٍ؛ MIT |
| microsoft/wiki-qa | 2 | كافٍ؛ MIT |
| microsoft/wiki-researcher | 2 | كافٍ؛ MIT |
| obra/dispatching-parallel-agents | 2 | كافٍ؛ MIT |
| obra/finishing-a-development-branch | 2 | كافٍ؛ MIT |
| obra/receiving-code-review | 2 | كافٍ؛ MIT |
| obra/requesting-code-review | 3 | كافٍ؛ MIT |
| obra/test-driven-development | 3 | كافٍ؛ MIT |
| obra/using-superpowers | 9 | كافٍ للترخيص؛ تحفظ وظيفي أدناه |
| obra/verification-before-completion | 2 | كافٍ؛ MIT |

فحص أسماء الإشعارات شمل أيضًا `THIRD_PARTY_NOTICES.md` في جذر Anthropic، وليس أسماء LICENSE/NOTICE الحرفية فقط. يحدد الإشعار برمجيات/خطوطًا مثل imageio وFFmpeg؛ الحزمتان نصيتان لا تحتويان تلك الأصول. فُحصت الملفات التعليمية والمراجع كنص يحتمل توجيه الوكيل، دون تنفيذ تعليماتها. لا توجد scripts أو binaries أو symlinks أو ملفات ذات mode تنفيذي في جرد الـ24 المثبت. تراخيص MIT المرفقة تطابق الجذور بايتًا ببايت، بما فيها copyright؛ لا يعتمد الحكم على مجرد علنية المستودع.

عينات قابلة للفحص من الأدلة: `microsoft/install-atk/SKILL.md` بصمة `86498df46a34070e105af3f9283cb3a51f6c4c5cb489bceb092a2566efbbb527`؛ وLICENSE Microsoft المرفق بصمة `d9a1b1e30d633d5732ea18e3cba9538d293ebc53e1a9e4e96ab739e0c5c4f1cb`. بقية البصمات ومساراتها في JSON.

## الأدلة الناقصة والتحفظات غير المحسومة

- **`using-superpowers` غير جاهزة للاعتماد بوصفها مهارة مستقلة مثبتة السلوك.** [SKILL.md:22](https://github.com/AxiomNode-lab/AI-Skills-Hub/blob/8d2b453787f00e640fc064cb9b2422550da5deef/skills/obra/using-superpowers/SKILL.md#L22) يفرض `brainstorming` قبل التخطيط، والسطر 30 يفرضها قبل البناء. [سجل المراجعة:52](https://github.com/AxiomNode-lab/AI-Skills-Hub/blob/8d2b453787f00e640fc064cb9b2422550da5deef/catalog/reviews/obra__using-superpowers.json#L52) يعترف بأن تلك المهارة محظورة، مع بقاء blocking_findings فارغة. التثبيت المنفرد لا يوفر الاعتماد المطلوب. المطلوب تجربة محددة تثبت السلوك عند غيابه، أو سياسة تبعية/تعليق إصدار موثقة. لم أفتح الحظر أو أغير محتوى upstream؛ لا تكفي اختبارات نسخ الملفات لحسم ذلك.
- أوامر `install-atk` تنفذ `npx -y` لحزمة غير مقفلة، و`finishing-a-development-branch` تتضمن عمليات Git ودمجًا/تنظيفًا بعد اختيار المستخدم. تصنيف medium وتفسيره موجودان؛ لم أنفذ تلك الأوامر ولم أعتبر المراجعة ضمانًا لسلوك الوكيل.
- الإحالات في المهارات التعليمية إلى خدمات أو أوراق أو SDKs لا تثبت صحة أمثلتها وقت الاستخدام. لم تُجر تجارب SDK أو تقييم توصيات/كتابة/قرارات، ولم يُثبت أثر سببي لتحسن الأداء.

## التحقق المنفذ

- **بوابة الإصدار الأصلية:** اختبارات الملفات الزائدة والمتغيرة والناقصة، والبصمات والمراجعة المعدلة، ومسارات الجرد غير الآمنة، وGit modes غير المسموحة، والنتائج غير المقبولة أو عالية الخطورة نجحت. أعيد فحص الجرد والبصمات للـ27 حزمة. ثغرة YAML ونص MIT القصير أعلاه تكشفان ما لم تكن هذه الاختبارات تغطيه.
- **CLI خارج Hub:** `search/info/install` تعمل دون فهرس في المشروع وفق الاختبارات الأصلية. وفي تجربة إضافية غير متصلة بالشبكة، استُخدم مشروع مؤقت خارج checkout يحتوي فهرسًا فارغًا متعمدًا؛ البحث قرأ فهرس Hub، وتثبيت الـ27 حزمة ذهب إلى `.agents/skills` في المشروع وحده، وطابقت ملفاتها manifest، وأظهر info/list حالتها installed. طلب ID مجهول وتثبيت مهارة معلقة وأخرى محظورة رُفضا. لا تثبيت على user scope.
- **الأوصاف:** حُددت الـ107 من مقارنة `main` بالنسخة الأصلية، ثم جُلب SKILL.md لكل واحدة عند revision المثبت. تطابقت SHA-256 المسجلة والوصف بعد تطبيع المسافات في 107/107، مع المحلل الأصلي ثم الصارم. JSON يحفظ نتائج كل وصف. لم تتغير الأوصاف أو ملفات المهارات في فرع الإصلاح.
- **Windows المحلي / Node 24.19.0:** `pnpm.cmd validate-all` على PR الأصلي: 21 ملف اختبار، 139 اختبارًا، 138 ناجحًا، 0 فشل، 1 skipped بسبب EPERM في اختبار symlink القديم. على الإصلاح: 22 ملف اختبار، **148 اختبارًا، 147 ناجحًا، 0 فشل، 1 skipped**. اختبار junction الجديد يعمل وينجح دون تخطٍّ. validate-workspace/static-check/schemas/registry/materialized مرت جميعًا.
- **CI الأصلي / Node 22:** [تشغيل 37078168685](https://github.com/AxiomNode-lab/AI-Skills-Hub/actions/runs/37078168685) على Windows وUbuntu: 21 ملف اختبار، **139 ناجحًا من 139، صفر فشل/تخطٍّ** لكل نظام. السجل يثبت أنه اختبر merge ref عند `cfb3113` الناتج من PR head المذكور وmain المذكور؛ وليس هذه الإصلاحات. CodeQL وDependency Audit وSecret Scan ناجحة أيضًا، ولا تُستخدم هنا كدليل ترخيص.

فشلت المحاولة الأولى لتشغيل pnpm داخل القيد المحلي بسبب فتح قاعدة بياناته؛ التشغيل المسموح خارج القيد نجح. أثناء تطوير الإصلاح ظهر اختلاف CRLF في fixture الترخيص على Windows، وصُحح قبل التحقق النهائي؛ لم يكن عيبًا في مصادر المهارات.

## التداخل مع PR #9

PR #9 عند `374600706b299dccd1212ad7e396019dc4ef7e73`. مقارنة الملفات ومحاكاة `git merge-tree <merge-base> <pr10> <pr9>`، دون دمج أو تحريك HEAD، تبينان أن الملف المشترك الوحيد هو `docs/STATUS.md` وأن التغييرات تُجمع دون conflict markers. لم تتغير ملفات المهارات الثلاث أو بصماتها بين PR #9 وPR #10.

استخرجت اختبارات التقييم السبعة وfixtures وأداة التحقق من PR #9 إلى مجلد معزول؛ نجحت **7/7**. هذا اختبار لأداة التقييم فقط، وليس إعادة تشغيل للمهارات. تشغيلها الأول من cwd غير مجلد fixtures أخفق في العثور على cases.json؛ إعادة التشغيل من جذر النسخة المعزولة نجحت.

يلزم تحديث صياغة «المهارات المحلية الثلاث» لتقول «المهارات الثلاث المختارة للتقييم»، لأن الإصدار المقترح يحتوي 27. تبقى نتائج PR #9 التاريخية `not-run` للمهارات الثلاث، ولا تمتد إلى الـ24 الجديدة. العدد المتوقع بعد جمع الاختبارات هو 146 قبل هذه الإصلاحات، و155 معها؛ هذان عددان حسابيان، ولم أنفذ دمجًا للاختبار.

## ما لم يُتحقق منه والحكم

لم أشغل Linux محليًا؛ اعتمدت على سجل CI الأصلي لـLinux. نتائج CI الأصلية لا تشمل فرع الإصلاح. لم أختبر عميل MCP رسوميًا كاملًا أو جميع قيود المتصفحات، ولم أختبر سباقات تبديل ملفات متزامنة. الفهرس ومراجعاته ملفات موثوقة محليًا؛ ليست لها توقيعات مستقلة ضد مهاجم يستطيع تعديلها جميعًا. اختبارات التثبيت ليست تقييم أداء.

**PR #10 الأصلي يحتاج إصلاحًا قبل الدمج** بسبب تسريب المحتوى غير المراجع وتجاوز تصريح الترخيص وحدود HTTP والتحقق الضعيف من المدخلات ونص MIT. فرع الإصلاح يعالج العيوب المؤكدة مع اختبارات رفض وتوثيق، ويجب مراجعته والتحقق منه على النظامين قبل إدخاله في PR #10. يبقى اعتماد `using-superpowers` المستقل بحاجة إلى دليل إضافي. لا توجد موافقة على دمج أي PR في هذا التقرير.
