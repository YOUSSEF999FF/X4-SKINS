/* X4 SKINS 18 MAX — i18n.js : six languages, auto-detected from the phone, switchable instantly */
(function () {
  'use strict';
  var X4 = (window.X4 = window.X4 || {});

  /* order requested: Arabic, English, Spanish, Vietnamese, Hindi, Brazilian Portuguese */
  var LANGS = [
    { code: 'ar', name: 'العربية', flag: '🇪🇬', dir: 'rtl' },
    { code: 'en', name: 'English', flag: '🇺🇸', dir: 'ltr' },
    { code: 'es', name: 'Español', flag: '🇪🇸', dir: 'ltr' },
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳', dir: 'ltr' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳', dir: 'ltr' },
    { code: 'pt', name: 'Português (BR)', flag: '🇧🇷', dir: 'ltr' }
  ];

  var S = {
    'net.title': {
      ar: 'لا يوجد اتصال بالإنترنت', en: 'No Internet Connection', es: 'Sin conexión a Internet',
      vi: 'Không có kết nối Internet', hi: 'इंटरनेट कनेक्शन नहीं है', pt: 'Sem conexão com a Internet'
    },
    'net.msg': {
      ar: 'تعذّر الوصول إلى الإنترنت. تأكد من اتصالك بشبكة Wi‑Fi أو بيانات الهاتف ثم أعد المحاولة. سيعود التطبيق للعمل تلقائيًا فور عودة الاتصال.',
      en: "We couldn't reach the internet. Check your Wi‑Fi or mobile data and try again. The app will resume automatically once you're back online.",
      es: 'No pudimos acceder a Internet. Revisa tu Wi‑Fi o tus datos móviles e inténtalo de nuevo. La aplicación continuará automáticamente cuando vuelva la conexión.',
      vi: 'Không thể truy cập Internet. Hãy kiểm tra Wi‑Fi hoặc dữ liệu di động rồi thử lại. Ứng dụng sẽ tự động tiếp tục khi có kết nối trở lại.',
      hi: 'इंटरनेट तक पहुँच नहीं हो सकी। अपना Wi‑Fi या मोबाइल डेटा जाँचें और फिर कोशिश करें। कनेक्शन वापस आते ही ऐप अपने आप चालू हो जाएगा।',
      pt: 'Não foi possível acessar a Internet. Verifique seu Wi‑Fi ou dados móveis e tente novamente. O app continuará automaticamente quando a conexão voltar.'
    },
    'net.retry': {
      ar: 'إعادة المحاولة', en: 'Retry', es: 'Reintentar', vi: 'Thử lại', hi: 'फिर से कोशिश करें', pt: 'Tentar novamente'
    },
    'net.checking': {
      ar: 'جارٍ الفحص…', en: 'Checking…', es: 'Comprobando…', vi: 'Đang kiểm tra…', hi: 'जाँच हो रही है…', pt: 'Verificando…'
    },
    'net.still': {
      ar: 'لا يزال الاتصال مقطوعًا', en: 'Still offline', es: 'Sigue sin conexión', vi: 'Vẫn chưa có kết nối', hi: 'अभी भी ऑफ़लाइन', pt: 'Ainda sem conexão'
    },
    'gate.title': {
      ar: 'أدخل كلمة المرور', en: 'Enter Password', es: 'Introduce la contraseña',
      vi: 'Nhập mật khẩu', hi: 'पासवर्ड दर्ज करें', pt: 'Digite a senha'
    },
    'gate.sub': {
      ar: 'الدخول متاح بكلمة المرور فقط', en: 'Access requires the password', es: 'El acceso requiere la contraseña',
      vi: 'Cần mật khẩu để truy cập', hi: 'प्रवेश के लिए पासवर्ड आवश्यक है', pt: 'O acesso requer a senha'
    },
    'gate.placeholder': {
      ar: 'كلمة المرور', en: 'Password', es: 'Contraseña', vi: 'Mật khẩu', hi: 'पासवर्ड', pt: 'Senha'
    },
    'gate.confirm': {
      ar: 'تأكيد', en: 'Confirm', es: 'Confirmar', vi: 'Xác nhận', hi: 'पुष्टि करें', pt: 'Confirmar'
    },
    'gate.wrong': {
      ar: 'كلمة المرور غير صحيحة', en: 'Incorrect password', es: 'Contraseña incorrecta',
      vi: 'Mật khẩu không đúng', hi: 'पासवर्ड गलत है', pt: 'Senha incorreta'
    },
    'gate.empty': {
      ar: 'اكتب كلمة المرور أولًا', en: 'Type the password first', es: 'Escribe la contraseña primero',
      vi: 'Hãy nhập mật khẩu trước', hi: 'पहले पासवर्ड लिखें', pt: 'Digite a senha primeiro'
    },
    'gate.unavailable': {
      ar: 'تعذّر تحميل بيانات الدخول، أعد المحاولة', en: "Couldn't load access data, try again",
      es: 'No se pudieron cargar los datos de acceso, inténtalo de nuevo',
      vi: 'Không tải được dữ liệu truy cập, hãy thử lại', hi: 'एक्सेस डेटा लोड नहीं हो सका, फिर कोशिश करें',
      pt: 'Não foi possível carregar os dados de acesso, tente novamente'
    },
    'gate.noLink': {
      ar: 'الرابط غير مضاف بعد', en: 'Link not set yet', es: 'Enlace aún no configurado',
      vi: 'Chưa có liên kết', hi: 'लिंक अभी जोड़ा नहीं गया', pt: 'Link ainda não definido'
    },
    'gate.show': {
      ar: 'إظهار كلمة المرور', en: 'Show password', es: 'Mostrar contraseña', vi: 'Hiện mật khẩu', hi: 'पासवर्ड दिखाएँ', pt: 'Mostrar senha'
    },
    'skip': {
      ar: 'تخطي', en: 'Skip', es: 'Omitir', vi: 'Bỏ qua', hi: 'छोड़ें', pt: 'Pular'
    },
    'back': {
      ar: 'رجوع', en: 'Back', es: 'Volver', vi: 'Quay lại', hi: 'वापस', pt: 'Voltar'
    },
    'update.later': {
      ar: 'لاحقًا', en: 'Later', es: 'Más tarde', vi: 'Để sau', hi: 'बाद में', pt: 'Mais tarde'
    },
    'update.btn': {
      ar: 'تحديث', en: 'Update', es: 'Actualizar', vi: 'Cập nhật', hi: 'अपडेट करें', pt: 'Atualizar'
    },
    'update.title': {
      ar: 'تحديث جديد متاح', en: 'New update available', es: 'Nueva actualización disponible',
      vi: 'Có bản cập nhật mới', hi: 'नया अपडेट उपलब्ध है', pt: 'Nova atualização disponível'
    },
    'update.msg': {
      ar: 'يتوفر إصدار أحدث من التطبيق.', en: 'A newer version of the app is available.',
      es: 'Hay una versión más reciente de la aplicación.', vi: 'Đã có phiên bản mới hơn của ứng dụng.',
      hi: 'ऐप का नया संस्करण उपलब्ध है।', pt: 'Há uma versão mais recente do app.'
    },
    'soon.title': {
      ar: 'هذا القسم قادم في التحديث التالي', en: 'This section arrives in the next update',
      es: 'Esta sección llegará en la próxima actualización', vi: 'Mục này sẽ có ở bản cập nhật tiếp theo',
      hi: 'यह सेक्शन अगले अपडेट में आएगा', pt: 'Esta seção chega na próxima atualização'
    }
  };

  var byCode = {};
  LANGS.forEach(function (l) { byCode[l.code] = l; });

  function detect() {
    var saved = X4.store.get('x4_lang');
    if (saved && byCode[saved]) return saved;
    var list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'en'];
    for (var i = 0; i < list.length; i++) {
      var base = String(list[i]).toLowerCase().split('-')[0];
      if (byCode[base]) return base;
    }
    return 'en';
  }

  var I = (X4.i18n = new X4.Emitter());
  I.langs = LANGS;
  I.lang = 'en';

  I.t = function (key) {
    var e = S[key];
    if (!e) return key;
    return e[I.lang] || e.en || key;
  };

  /* pick a value coming from a JSON file: string, or { ar:"", en:"", ... } */
  I.pick = function (v, fallbackKey) {
    if (v == null || v === '') return fallbackKey ? I.t(fallbackKey) : '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
      var r = v[I.lang] || v[I.lang === 'pt' ? 'pt-BR' : I.lang] || v.en;
      if (!r) { for (var k in v) { if (v[k]) { r = v[k]; break; } } }
      if (r) return String(r);
    }
    return fallbackKey ? I.t(fallbackKey) : '';
  };

  I.apply = function (root) {
    root = root || document;
    X4.$$('[data-i18n]', root).forEach(function (n) { n.textContent = I.t(n.getAttribute('data-i18n')); });
    X4.$$('[data-i18n-ph]', root).forEach(function (n) { n.setAttribute('placeholder', I.t(n.getAttribute('data-i18n-ph'))); });
    X4.$$('[data-i18n-aria]', root).forEach(function (n) { n.setAttribute('aria-label', I.t(n.getAttribute('data-i18n-aria'))); });
  };

  I.set = function (code, persist) {
    if (!byCode[code]) code = 'en';
    I.lang = code;
    var l = byCode[code];
    document.documentElement.lang = code === 'pt' ? 'pt-BR' : code;
    document.documentElement.dir = l.dir;
    if (persist) X4.store.set('x4_lang', code);
    I.apply(document);
    I.emit('change', code);
  };

  I.init = function () { I.set(detect(), false); };
})();
