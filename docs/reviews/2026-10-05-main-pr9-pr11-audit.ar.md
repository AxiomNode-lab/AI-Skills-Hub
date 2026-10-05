# مراجعة `main` وPR #9 وPR #11 وخطة العمل التالية

تاريخ اللقطة: 2026-10-05. هذه مراجعة مبنية على `origin/main` عند `998e8124ff37690cc1169cb67c65803257550eba`، وPR #9 عند `2aa378b0b65950a88d558149383d01137c25a244`، وPR #11 قبل إضافة هذا التقرير عند `c8df71bcfd897fd9aee2fbe5323db29d98baf98a`. أُضيف التقرير إلى فرع PR #11 الموجود؛ لم يتغير `main` محليًا أو على GitHub. القائمة الدقيقة للمهارات الـ139 التي ناقشها PR #11 وحالتها الحالية في [ملف المطابقة](2026-10-05-pr10-expansion-reconciliation.json).

## النتيجة التي تحكم العمل

- طلبا السحب المفتوحان هما [#9](https://github.com/AxiomNode-lab/AI-Skills-Hub/pull/9) و[#11](https://github.com/AxiomNode-lab/AI-Skills-Hub/pull/11). أظهر GitHub أن كليهما `CONFLICTING` في 2026-10-05. فحوصهما الخضراء تخص رؤوسًا قديمة ولا تثبت التوافق مع `main` الحالي.
- دُمج [PR #10](https://github.com/AxiomNode-lab/AI-Skills-Hub/pull/10) في 2026-10-04، ثم دخلت إلى `main` حزمة npm وإصلاحات من PR #11 عبر commit `144b14b5`. لذلك لا ينبغي دمج PR #11 بحالته القديمة أو نقل حذفه الجماعي للملفات: فرعه يختلف عن `main` في مئات ملفات المهارات وmanifests.
- يحتوي `main` الآن 1083 سجلًا: 415 `bundled` مؤهلة ومادية، 616 `review-required`، 12 `source-direct`، و40 `blocked`. إصدار 415 مهارة يعني مراجعة المصدر والترخيص وسلامة الملفات وفق سياسة المشروع، ولا يعني نجاحًا في مهمة فعلية.
- من توسعة الـ139 التي علّقها PR #11: 135 مهارة مؤهلة حاليًا في `main` و4 معلّقة. توجد مراجعات مستقلة إضافية لـ40 منها ضمن `docs/reviews/independent-batch-0{1,2,3,4}.json`؛ 99 من الـ135 المؤهلة لا يظهر لها سجل في هذه الدفعات: 78 من Microsoft، و19 من K-Dense، و2 من obra، وجميعها مصنفة `medium` في السجل الحالي. وجود مراجعة PR #10 الأصلية لا يساوي المراجعة المستقلة التي طلبها PR #11. هذه فجوة دليل وسياسة إصدار، وليست إثباتًا بأن المهارات الـ99 ضارة أو مخالفة الترخيص.
- PR #9 يضيف مشغّل تقييم ومهامًا ثابتة لثلاث مهارات فقط. لم تنتج جلسات التقييم السابقة ملفات فعلية، لأن السياسة منعت Codex المتداخل من القراءة والكتابة؛ الحالة الصحيحة تبقى `not-run` و`unproven` و`human_review: pending`.

## ما شغّلناه فعلًا

في worktree معزول على Windows، Node `v24.19.0` وpnpm `10.4.1`: نجح تثبيت الاعتمادات من cache باستخدام `pnpm install --frozen-lockfile --offline`، واشتغلت أوامر `--help` و`search` و`info` من `node packages/cli/bin/skills-hub.mjs`. نجح `pnpm validate-all`: 9 حزم workspace، 97 وحدة JavaScript، 5 ملفات schema، 1083 سجلًا، 415 مهارة مقفلة ومادية متحققة، و578 اختبارًا: 577 ناجحًا، صفر فشل، وتخطٍّ واحد لاختبار symlink على Windows. نجح `pnpm e2e:package`: بنى tarball بحجم 4,167,761 بايت و2366 ملفًا، ثم جرّب تثبيته وتشغيل CLI وMCP و`npx` من tarball محلي. ظهر تحذير Node `DEP0190` من استخدام `shell: true` في مشغّل E2E على Windows؛ لم يفشل الفحص، ويمكن إزالة التحذير في تحسين منفصل لـ`scripts/e2e-package.mjs`. فحص `npm view @axiomnode-lab/skills-hub version --json` أعاد `E404`؛ لا تفترض أن `npx` من npm يعمل قبل النشر. لم نشغّل `verify-upstream` محليًا لأنه يعيد تنزيل كل الملفات ويتطلب الشبكة؛ CI هو موضع ذلك الفحص.

## العمل المطلوب في طلبَي السحب الموجودين

استخدم فرع `review/pr10-fixes` للأدلة وقرارات إصدار المهارات في PR #11، وفرع `feat/skill-behavior-evaluations` لمشغّل التقييم في PR #9. لا تنشئ PR ثالثًا، ولا تكتب على `main` ولا تدمج أو تستخدم force-push. احتفظ بـ`LOCAL-REVIEW.md` و`.pnpm-store/` خارج commits. قبل العمل البرمجي اللاحق، أصلح تعارض كل PR مع قاعدته الحالية بطريقة تحافظ على تغييرات `main` الجديدة؛ لا تدمج حذوفات PR #11 القديمة على `main`. بعد كل دفعة، أعد حساب الأرقام من `catalog/skills.json` ولا تنسخ أرقام هذا التقرير إذا تغيّر الرأس.

### 1. تحديث PR #9 ليستهدف `main` الحالي — أولوية عالية

حدّث فرع PR #9 نفسه على أساس `main` الحالي مع الحفاظ على ملفات `evaluations/skills/` و`scripts/evaluations/{checks,preflight,run}.mjs` و`tests/behavior-evaluations.test.mjs`؛ عالج تعارض `docs/STATUS.md` دون إعادة الأعداد القديمة. حدّث `docs/EVALUATIONS.md` و`docs/STATUS.md` بالأوامر والحالة الصحيحة وبأن الحالات الثلاث عينات من 415 مهارة، ولا تجعل نجاح التثبيت أو `turn.completed` أو exit code 0 دليلًا على تنفيذ مهمة. تأكد أن `scripts/build-package.mjs` و`tests/package-build.test.mjs` يُبقيان runner وraw traces خارج حزمة npm المنشورة. شغّل اختبارات المصنّف المركزة، ثم `pnpm validate-all` و`pnpm e2e:package` على الفرع المحدث. القبول: preflight يثبت قراءة `SKILL.md` والكتابة وقراءة الملف الناتج قبل أي جلسة مدفوعة؛ الرفض يوقف الحالات برمز غير صفري؛ وتظل النتائج التاريخية موسومة ببيئتها وتاريخها، لا تُعرض كاختبار لـ`main` الجديد.

### 2. حسم فجوة مراجعة مهارات PR #10 — أولوية عالية وقرار إصدار مطلوب

ابدأ بالـ99 ذات `independent_review_remaining: true` في ملف المطابقة. لكل مهارة راجع `skills/<publisher>/<name>/` كاملًا، و`catalog/reviews/<publisher>__<name>.json`، و`catalog/materialized-manifests/<publisher>__<name>.json`، ومصدرها عند commit المثبت، لا `SKILL.md` وحده. سجّل في `docs/reviews/independent-batch-*.json` وملف شرح مقابل: كل تعليمات ينفذها الوكيل، أوامر shell والتثبيت، الشبكة والاعتمادات، إنشاء/تعديل/حذف موارد، الروابط والإحالات خارج الحزمة، محتوى الطرف الثالث، حدود الترخيص والـNOTICE، والقرار مع موضع الدليل. قارن الجرد والبصمات والمصدر عبر `pnpm verify-upstream` في بيئة تسمح بالشبكة. لا تعتبر نتيجة scanner أو GitHub visibility أو نجاح install بديلًا عن القرار لكل ملف.

قبل أي تغيير في `catalog/skills.json`، اطلب من المسؤول عن سياسة الإصدار قرارًا صريحًا: هل تبقى المهارات الـ99 مؤهلة أثناء المراجعة، أم تعود إلى `review-required` على دفعات؟ إذا اختير تعليق إحداها، حدّث سجلها وreview والmanifest و`skills/` والlockfile عبر أدوات الإصدار المعتمدة، مع سبب ودليل واختبارات؛ لا تنفّذ حذفًا جماعيًا من فرع PR #11 القديم. احتفظ بالدفعات الـ40 التي روجعت حديثًا وبالـ4 المعلّقة وفق الأدلة الحالية ما لم يظهر سبب جديد. القبول: قائمة كل مهارة وقرارها قابلة للتتبع، وكل تغيير حالة يمر `validate-all` وفحوص integrity، والأعداد موثقة دون ادعاء تقييم أداء.

### 3. مراجعة الإحالات والأمثلة الحساسة — أولوية عالية

راجع خصوصًا `skills/microsoft/azure-ai-projects-ts/` و`skills/microsoft/azure-ai-voicelive-ts/` و`skills/microsoft/azure-monitor-ingestion-java/`؛ كلها مؤهلة حاليًا. أشار تقرير PR #11 إلى ملفات أو sibling skills غير مشحونة، وإلى مثال قد يطبع API key. توجد مراجعة لاحقة لـ`azure-monitor-ingestion-java` في `independent-batch-03.json` تصف الإحالة بأنها اختيارية، لكن الرابط نفسه لا يعمل بعد التثبيت. حدد لكل إحالة هل هي مطلوبة لوظيفة المهارة أم توثيق اختياري؛ إذا كانت مطلوبة، أعلن dependency مؤهلة أو علّق المهارة. إذا كانت اختيارية، وثق الخلل وأصلحه في upstream أو عبر سياسة توزيع معلنة، مع احترام بصمات الملفات ونسخ المصدر. افحص أمثلة طباعة الأسرار وإنشاء/حذف الموارد في review مستقل، ولا تعدّل نص المصدر المنسوخ بصمت. أضف اختبارات للبوابة في `scripts/validate-registry.mjs` و`tests/registry-policy.test.mjs` فقط إذا تغيّرت القاعدة العامة.

### 4. تقييم الأداء الفعلي بعد نجاح preflight — أولوية عالية لكن يعتمد على البيئة

بعد تحديث فرع PR #9، شغّل `node scripts/evaluations/run.mjs --case all --codex-js <path>` فقط في بيئة تسمح للـCodex المتداخل بقراءة وكتابة ملفات المشروع ضمن السياسة العادية. إذا فشل preflight، وثق التشخيص وتوقف؛ لا تخفف السياسة ولا تعيد الحالات المدفوعة. إذا نجح، احتفظ بـJSONL وhashes، وتحقق من قراءة التعليمات كاملة، تنفيذ الأدوات، الملفات الناتجة، والبصمات بعد التنفيذ. مراجع بشري مستقل يفتح HTML محليًا عند 1440×900 و390×844، يختبر التفاعل وfocus/reduced motion والألوان والخطوط المحسوبة، ويقارن كل معلومة في 3P مع `cases.json`. يسجل اسمه وتاريخه والبصمات والملاحظات. من دون artifacts ومراجعة بشرية تبقى الحالة `pending`؛ وحتى النجاح في مهمة واحدة لا يثبت التحسن على baseline بلا مهارة.

### 5. النشر وطريقة التشغيل — بعد قبول بوابات الثقة

المشروع CLI وليس واجهة ويب. شغّله الآن من checkout باستخدام Node 22+ وpnpm 10.4.1:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd validate-all
node packages/cli/bin/skills-hub.mjs --help
node packages/cli/bin/skills-hub.mjs available --agent codex
node packages/cli/bin/skills-hub.mjs search "frontend design" --agent codex --limit 5
node packages/cli/bin/skills-hub.mjs info anthropics/frontend-design --agent codex
```

لتجربة التثبيت، انتقل إلى **مشروع تجريبي منفصل** وشغّل المسار المطلق لملف `packages/cli/bin/skills-hub.mjs` مع `install anthropics/frontend-design --agent codex --scope project`، ثم `list --agent codex --scope project`. راقب `.agents/skills/frontend-design/` و`.ai-skills-hub/installed.json`. يمكن تجربة `mcp` أو `serve` للقراءة فقط بعد فهم أنهما بلا مصادقة وHTTP محلي افتراضيًا. البناء والنشر موثقان في `scripts/build-package.mjs` و`scripts/e2e-package.mjs` و`.github/workflows/release.yml` و`docs/RELEASING.md`. أول نشر npm يتطلب إعداد trusted publisher وقرار maintainer ونشر release tag؛ لا تنشئ tag ولا تنشر من هذا PR. بعد النشر فقط يصبح `npx @axiomnode-lab/skills-hub --help` مسارًا عامًا مثبتًا.

### 6. أعمال لاحقة منفصلة عن إغلاق الفجوات أعلاه

ارجع إلى `docs/ROADMAP.md` بدل توسيع هذا PR بلا حدود: معاملات update/rollback، sandbox للاستخراج، توقيع artifacts، فحص أعمق للمراجع والاعتمادات، pagination للـMCP، مصفوفة توافق للعملاء، ثم واجهة فهرس ويب إن تقرر أنها مطلوبة. ابدأ في كل بند باختبار قبول محدد، ثم عدّل ملفات التنفيذ المعنية وdocs؛ لا تجعل وجود UI شرطًا لاستخدام CLI الحالي.

## معيار إنهاء العمل على PR #9 وPR #11

اربط كل commit بدفعة واضحة من البنود 1–4 على PR المختص، وحدّث هذا التقرير ومصفوفة المهارات في PR #11 إذا تغيرت حالة المهارات. اطلب مراجعة الفرق على سياسة إبقاء أو تعليق الـ99 قبل تعديل release states. أعِد تشغيل `pnpm validate-all` و`pnpm e2e:package` على آخر commit لكل فرع، وراجع CI على Windows وLinux وفحوص الأمان. اترك نتيجة التقييم السلوكي `not-run` إن بقيت السياسة مانعة، وسجل بدقة ما يحتاجه المراجع البشري. لا تدمج أي PR ضمن هذا العمل.
