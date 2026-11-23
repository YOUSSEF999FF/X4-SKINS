# X4 SKINS 18 MAX — المرحلة 1

التطبيق بيتبني تلقائي على GitHub (GitHub Actions) ويطلّع ملف APK جاهز. كل بيانات التحكم في مجلد `data/`.

## أول مرة (من الموبايل)
1. اعمل مستودع جديد على GitHub واختار **Public** (لازم Public علشان التطبيق يقرا ملفات `data/`).
2. **Add file ← Create new file** واكتب الاسم بالظبط: `.github/workflows/build-user-app.yml` والصق جواه محتوى الملف `build-user-app.yml` اللي معاك، وبعدها **Commit changes**.
3. **Add file ← Upload files** وارفع `x4app.zip` زي ما هو (من غير ما تفكّه)، وبعدها **Commit changes**.
4. افتح تبويب **Actions** — هتلاقي `Build user app (APK)` شغّال (أول مرة بياخد 5–10 دقايق). الـ zip بيتفك لوحده.
5. لما يخلص ✅ ادخل **Releases** ← آخر إصدار ← نزّل `X4-SKINS-18-MAX.apk` وثبّته على موبايلك.

## مفتاح التوقيع (مهم علشان التحديثات تتثبت فوق القديم)
قبل أول بناء: **Settings ← Secrets and variables ← Actions ← New repository secret**
- الاسم: `SIGNING_PASSPHRASE`
- القيمة: جملة سر طويلة (16 حرف أو أكتر) **احتفظ بيها في مكان آمن**.

أول بناء بيعمل المفتاح ويحفظه مشفّر جوه المستودع (`signing/release.jks.enc`)، وكل البناءات بعد كده بتستخدمه.
لو ما عملتش الـ Secret، التطبيق بيتبني بمفتاح مؤقت: بيتثبت عادي، لكن مش هيتثبّت فوق نسخة متوقّعة بمفتاح تاني (لازم تمسح القديمة).

## ملفات التحكم (`data/`)
- `gate.json` — كلمة المرور (هاش مش نص صريح) + رابط وعنوان زرّي Get Pass و How To Get Pass.
  لتغيير الباسورد: افتح `tools/make-hash.html` في Chrome، اكتب الباسورد الجديد، وانسخ الناتج مكان محتوى `gate.json`.
  أول ما الباسورد يتغيّر، كل المستخدمين بيتطلب منهم يدخلوه من جديد.
- `update.json` — دايلوج التحديث: `latestVersion` (لو أكبر من نسخة التطبيق المثبّتة يظهر الدايلوج)، `force` (true = بدون زر إغلاق)، `title` و`description` بكل اللغات، و`button.label` و`button.url`.
- `ping.txt` — ملف الفحص الاحتياطي للإنترنت (لازم يفضل فيه كلمة `ok`).

## إصدار نسخة جديدة
1. غيّر الرقم في `user-app/VERSION` (مثلًا `1.1.0`) ← الـ APK الجديد بيتبني تلقائي.
2. في `data/update.json` خلّي `latestVersion` = نفس الرقم، و`button.url` = `https://github.com/<حسابك>/<المستودع>/releases/latest/download/X4-SKINS-18-MAX.apk`.

## فيديو خلفية الصفحة الثانية
ضع الملف باسم `bg.mp4` في: `user-app/app/src/main/assets/www/assets/`. من غيره بتظهر خلفية نيون متحركة بدالُه.
