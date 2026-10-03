# متابعة المراجعة المستقلة لتوسعة PR #10

تاريخ المراجعة: 2026-10-03. رأس PR #10 المفحوص هو `42117636827f64527f7a5e2bdfdba5375ad00aa4`، وخط الأساس للمراجعة الأولى هو `8d2b453787f00e640fc064cb9b2422550da5deef`. هذه متابعة داخل PR #11 ولا تتضمن موافقة على دمج PR #10 أو PR #11.

## الحكم

توسعة الإصدار من 27 إلى 166 مهارة **تحتاج دليلًا إضافيًا قبل الدمج**. أثبت الفحص المستقل المصدر والترخيص وسلامة البايتات للدفعة المقترحة، لكنه لم يثبت مراجعة دلالية مستقلة مكتملة لكل تعليمات المهارات الـ139. لذلك أعاد PR #11 هذه الدفعة إلى `review-required`، وأزال نسخها المادية وmanifests الخاصة بها من الإصدار، وأبقى سجلات مراجعة PR #10 كأدلة مقترحة للفحص. أصبح العدد المحلي المؤهل 26 بعد تعليق `obra/using-superpowers` أيضًا.

## العيوب المؤكدة، مرتبة حسب الخطورة

### مرتفع: بوابة الإصدار لم تكن تتحقق من تبعيات المهارات

- **الموضع:** `scripts/validate-registry.mjs`؛ سجل `obra/using-superpowers` في `catalog/skills.json`؛ والتعليمات في `skills/obra/using-superpowers/SKILL.md:22,30` عند رأس PR #10.
- **إعادة الإنتاج على رأس PR #10:** شغّل `node scripts/validate-registry.mjs` ثم افحص `obra/using-superpowers`. ينجح التحقق مع `release.status=eligible` رغم أن التعليمات تفرض `brainstorming` قبل التخطيط والبناء، بينما `obra/superpowers/brainstorming` حالتها `blocked` و`source.state=missing`. سجل المراجعة نفسه كان يذكر التبعية المحظورة مع `blocking_findings: []`.
- **الأثر:** يمكن نشر مهارة تبدو مستقلة، ثم تطلب مهارة غير متاحة في مسار أساسي من عملها. كما كان أي حقل `dependencies` غير قابل للتعبير ضمن schema، مع أن CLI يقرأه عند التثبيت.
- **الإصلاح في PR #11:** أضيف `dependencies` إلى schema، وفحص ثنائي المرور يرفض التبعية المجهولة ويرفض أهلية أي مهارة تعتمد على سجل غير bundled/materialized/eligible. سُجل اعتماد `obra/using-superpowers` صراحة، وحُولت إلى hold بسبب `blocked-dependency:obra/superpowers/brainstorming`، وحُدّث سجل مراجعتها إلى `held` مع finding مانع. اختبار الانحدار يبني سجلًا مؤقتًا فيه مهارة مؤهلة تعتمد على مهارة محظورة ويتحقق من الرفض.

### مرتفع: توسعة 139 مهارة عوملت كإصدار مكتمل دون مراجعة مستقلة قابلة للإثبات في PR #11

- **الموضع:** سجلات `catalog/skills.json` و`catalog/reviews/*.json` ونسخ `skills/` و`catalog/materialized-manifests/` التي أضافها commit `42117636`.
- **إعادة الإنتاج:** قارن المهارات المادية المؤهلة في `8d2b4537` و`42117636`. النتيجة 139 سجلًا إضافيًا: 19 K-Dense، و118 Microsoft، و2 obra، و598 ملفًا. شغّل `node scripts/audit-pr10-expansion.mjs 8d2b4537 refs/remotes/origin/pr10-latest docs/reviews/pr10-expansion-source-evidence.json` لرؤية القائمة الدقيقة لكل مهارة وملفاتها.
- **الأثر:** نجاح فحص آلي أو تثبيت الملفات لا يثبت أن تعليمات كل مهارة قرئت دلاليًا أو أنها آمنة أو مفيدة في أداء مهمة. إبقاء الدفعة eligible كان سيحول هذا النقص إلى ادعاء إصدار.
- **الإصلاح في PR #11:** جميع المهارات الـ139 أصبحت `review-required` مع سبب `independent-instruction-review-incomplete`، و`security.scan_status=review-required`، وأزيلت نسخها وmanifests الخاصة بها من الإصدار والlockfile. لم تُخفف أي قاعدة ترخيص أو أمان للوصول إلى عدد محدد.

## دليل المصدر والترخيص والجرد

الفحص الآلي المستقل قرأ أشجار GitHub غير المبتورة عند النسخ التالية:

| المصدر | النسخة الثابتة | المهارات | ملف الترخيص الأعلى |
| --- | --- | ---: | --- |
| `K-Dense-AI/scientific-agent-skills` | `154988403bb5a18e9d3c0ce4e6d5e2e4b184a298` | 19 | `LICENSE.md` |
| `microsoft/skills` | `84d8eaa8ae95930f55cdceb3e27196c795dab038` | 118 | `LICENSE` |
| `obra/superpowers` | `8ca22dba9a94f28898bbce59f2537ff4d87c747d` | 2 | `LICENSE` |

لكل ملف من الملفات الـ598، قورن المسار والحجم وSHA-256 وGit blob وmode بسجل المراجعة وmanifest والشجرة المثبتة. تطابقت الجردات كلها، ولم يوجد symlink أو special file أو nested LICENSE/COPYING/NOTICE/COPYRIGHT داخل مسارات المهارات. تطابقت نسخ `LICENSE.txt` المرفقة مع Git blob لترخيص الجذر. القائمة الدقيقة للمهارات والملفات وملفات الترخيص الأعلى محفوظة في `docs/reviews/pr10-expansion-source-evidence.json`.

هذا يثبت سلامة المصدر ودليل MIT لهذه الملفات عند النسخ المحددة فقط. لا يحول ترخيص جذر Hub إلى دليل، ولا يثبت أن أمثلة SDK صحيحة أو حديثة، ولا يثبت أداء المهارة.

## فحص التعليمات والتبعيات

فحص الإشارات الآلي غطى نصوص الملفات كلها وسجل، بوصفه triage فقط: 136 مهارة فيها shell fences، و71 فيها إشارات package install، و130 فيها كلمات أو أمثلة تغيير/حذف/إنشاء/رفع، و136 فيها شبكات أو credentials أو URLs. هذه أعداد مطابقات نصية وليست أحكامًا أمنية.

راجعت يدويًا المسارات ذات الصلة المباشرة بالقرار: `obra/using-superpowers` و`obra/diagnosing-superpowers` و`obra/using-git-worktrees`، والإحالات الخارجية التي كشفها الفحص في `microsoft/azure-ai-projects-ts` و`microsoft/azure-ai-voicelive-ts` و`microsoft/azure-monitor-ingestion-java`، وسجلات المخاطر الأعلى لـK-Dense وAzure. ظهر ما يلي:

- `using-superpowers` يعتمد وظيفيًا على `brainstorming` المحظورة؛ عولج كعيب مانع كما سبق.
- `diagnosing-superpowers` يقرأ transcripts حساسة، يكتب تقارير، يشغّل subagents، وقد يبحث أو ينشئ GitHub issue بعد موافقة. سجل PR #10 يصف ذلك كـmedium، لكن هذه المتابعة لا تعيد اعتماده ضمن الإصدار.
- `using-git-worktrees` ينشئ worktree/branch، قد يغيّر `.gitignore` ويعمل commit، ويشغّل installers واختبارات؛ بقي خارج الإصدار حتى مراجعة مستقلة مكتملة.
- `microsoft/azure-ai-projects-ts` يحتوي pointer خارج الحزمة، وعينة تطبع API key رغم نص لاحق يمنع تسجيل credentials. `microsoft/azure-monitor-ingestion-java` يشير إلى sibling skill غير مشحونة. الإحالات وُثقت سابقًا في سجلات PR #10، لكنها تؤكد ضرورة عدم مساواة اكتمال الجرد باكتمال الوظيفة.

لم أجرّب SDKs أو cloud calls أو صحة أمثلتها، ولم أنفذ أوامر المهارات. لذلك لا توجد دعوى نجاح أداء لأي مهارة من الدفعة.

## ما بقي غير محسوم ويحتاج قرار صاحب PR #10

1. تقديم مراجعة دلالية قابلة للتتبع لكل واحدة من المهارات الـ139، مع قرار مستقل لكل أمر أو تغيير بيانات أو وصول شبكي/اعتماد أو إحالة خارج الحزمة. يمكن إعادة إصدار المهارات تدريجيًا؛ لا يلزم الوصول إلى 166 دفعة واحدة.
2. تحديد سياسة صريحة للإحالات الاختيارية إلى sibling skills والملفات غير المشحونة: إما dependency معلنة ومؤهلة، أو إزالة دعوى الاكتمال، أو إبقاء المهارة على hold.
3. بالنسبة إلى `using-superpowers`: إتاحة `brainstorming` بأدلة مستقلة، أو تعديل upstream/الحزمة بحيث تعمل دونها مع اختبار سلوكي، أو إبقاؤها معلقة. PR #11 لا يغير تعليمات upstream.
4. مراجعة دقة أمثلة SDK المتغيرة، خصوصًا العينات التي تطبع أسرارًا أو تنشئ/تحذف موارد. إثبات التثبيت وحده لا يكفي.

## حدود التحقق

الدليل JSON يميز صراحة النتائج الآلية (`automated_content_review_only: true`) عن القراءة اليدوية المستهدفة. لم تُعامل سجلات PR #10 المولدة أو CI كبديل للمراجعة المستقلة. نتائج Windows المحلية وCI بعد رفع آخر commit تُسجل في وصف/نتيجة PR #11 ولا تُستخدم كدليل ترخيص.

## نتائج التحقق المحلي

- `pnpm.cmd validate-all` النهائي على Windows وNode 24.19.0: 22 ملف اختبار، 149 اختبارًا، 148 ناجحًا، صفر فشل، واختبار واحد skipped لأن Windows رفض إنشاء symlink بـ`EPERM`. نجحت فحوص workspace وJavaScript syntax وschema وregistry و26 حزمة مادية وdedupe.
- التشغيل الكامل الأول بعد تعليق الدفعة كشف فشلًا حقيقيًا في fixture الاختبار: كان `reviewed-release.test.mjs` يعتبر وجود ملف review دليل إصدار حتى بعد تحويل السجل إلى hold، كما أن اختبار التبعية الجديد لم ينشئ مجلد temp الأعلى. أُصلح الاختبار ليختار فقط `eligible && materialized` وأُنشئ مجلد temp، ثم نجحت 37/37 من اختبارات الإصدار/التبعية المستهدفة والتشغيل الكامل أعلاه.
- لم يُشغّل Linux محليًا. على commit `255896588cbc4c62b576f16380341cb849d000f9` نجح [تشغيل CI رقم 37127905583](https://github.com/AxiomNode-lab/AI-Skills-Hub/actions/runs/37127905583): Ubuntu/Node 22 شغّل 22 ملفًا ونجح **149/149** بلا فشل أو تخطٍّ؛ Windows/Node 22 شغّل 22 ملفًا ونجح **149/149** بلا فشل أو تخطٍّ. نجحت أيضًا CodeQL وDependency Audit وSecret Scan؛ لا تُستخدم هذه الفحوص كدليل ترخيص أو أداء.
