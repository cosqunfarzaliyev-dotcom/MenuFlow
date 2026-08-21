import { createTranslationHook } from '@/lib/i18n';

// components/onboarding/OnboardingWizard.jsx only. A separate dictionary
// from lib/i18n/dictionaries/auth.js (which stays scoped to login/reset/the
// "pending activation" screen) — the wizard is a materially bigger, distinct
// piece of copy, same "one dictionary per surface" convention as
// admin/staff/superadmin. Runs signed-in (a restaurant_admin, post-
// assignment), so unlike auth.js, LanguageSwitcher here is mounted with
// `profile` and syncs to profiles.locale via hooks/useLocaleSync.js.
export const onboarding = {
  az: {
    // Chrome / navigation shared across every step
    stepLabel: (current, total) => `Addım ${current}/${total}`,
    nextButton: 'Növbəti',
    backButton: 'Geri',
    finishButton: 'Quraşdırmanı tamamla',
    goToAdminButton: 'İdarəetmə panelinə keç',
    genericSaveError: (msg) => msg || 'Yadda saxlanılmadı. Yenidən cəhd edin.',
    signOutLink: 'Fərqli hesabla davam etmək istəyirsiniz? Çıxış edin.',

    // 1. Restaurant info
    infoStepTitle: 'Restoran məlumatları',
    infoStepSubtitle: 'Restoranınızın adını və qısa sloganını təsdiqləyin.',
    restaurantNameFieldLabel: 'Restoran adı',
    restaurantNameFieldPlaceholder: 'Məs: Bağ Restoranı',
    restaurantNameRequired: 'Restoran adı boş ola bilməz.',
    taglineFieldLabel: 'Slogan (istəyə bağlı)',
    taglineFieldPlaceholder: 'Məs: Rəqəmsal QR Menyu Sistemi',

    // 2. Branding
    brandingStepTitle: 'Marka görünüşü',
    brandingStepSubtitle: 'Loqonuzun linkini əlavə edin — müştəri menyusunda və idarəetmə panelinin başlığında görünəcək. İstəsəniz bu addımı keçə bilərsiniz.',
    logoUrlFieldLabel: 'Loqo URL-i',
    logoUrlFieldPlaceholder: 'https://...',
    logoPreviewLabel: 'Önizləmə:',
    logoEmptyHint: 'Loqo əlavə etməsəniz, panel adının baş hərfi göstəriləcək.',

    // 3. Language
    languageStepTitle: 'Panel dili',
    languageStepSubtitle: 'İdarəetmə panelini hansı dildə istifadə etmək istəyirsiniz? İstənilən vaxt yenidən dəyişə bilərsiniz.',

    // 4. Currency
    currencyStepTitle: 'Valyuta',
    currencyStepSubtitle: 'Menyuda qiymətlər hansı valyuta ilə göstərilsin?',
    currencyOtherFieldPlaceholder: 'Digər',
    currencyFieldHint: 'Bu simvol bütün qiymətlərin yanında göstəriləcək (məs: 25 ₼).',

    // 5. Contact
    contactStepTitle: 'Əlaqə məlumatları',
    contactStepSubtitle: 'Müştərilər və komandanız sizinlə necə əlaqə saxlaya bilər? İstəyə bağlıdır, sonra da doldura bilərsiniz.',
    phoneFieldLabel: 'Telefon nömrəsi',
    phoneFieldPlaceholder: '+994 XX XXX XX XX',
    addressFieldLabel: 'Ünvan',
    addressFieldPlaceholder: 'Restoranın ünvanı',

    // 6. Tables
    tablesStepTitle: 'Masalar',
    tablesStepSubtitle: (count) => `Sizin üçün artıq ${count} masa hazırlanıb. İstəsəniz adlarını real masalarınıza uyğun olaraq dəyişin — qalanını Admin paneldəki "Masalar" bölməsindən idarə edə bilərsiniz.`,
    tablesEmptyHint: 'Masa tapılmadı. Masaları Admin paneldəki "Masalar" bölməsindən idarə edə bilərsiniz.',
    tableNumberLabel: (n) => `Masa ${n}`,
    tablesLoadingHint: 'Masalar yüklənir…',

    // 7. Initial menu
    menuStepTitle: 'İlkin menyu',
    menuStepSubtitle: 'Ən azı bir kateqoriya və məhsul əlavə edin — istəsəniz bunu sonra Admin paneldən də edə bilərsiniz.',
    categoryNameFieldPlaceholder: 'Məs: Əsas yeməklər',
    addCategoryButton: 'Kateqoriya əlavə et',
    productNameFieldPlaceholder: 'Məs: Adana Kabab',
    productPriceFieldLabel: 'Qiymət',
    addProductButton: 'Məhsul əlavə et',
    menuNeedsCategoryHint: 'Məhsul əlavə etmək üçün əvvəlcə ən azı bir kateqoriya yaradın.',
    menuEmptyOkHint: 'Menyu boş qala bilər — Admin paneldəki "Menyu" bölməsindən istənilən vaxt əlavə edə bilərsiniz.',

    // 8. Design
    designStepTitle: 'Dizayn',
    designStepSubtitle: 'Müştəri menyusunun əsas rənglərini seçin.',
    primaryColorFieldLabel: 'Əsas rəng',
    secondaryColorFieldLabel: 'İkinci rəng',
    designPreviewLabel: 'Önizləmə',
    designPreviewButtonText: 'Səbətə əlavə et',

    // 9. Completion
    completeTitle: 'Quraşdırma tamamlandı!',
    completeBody: 'Restoranınız hazırdır. İndi idarəetmə panelinizə keçib menyunuzu, masalarınızı və sifarişlərinizi idarə edə bilərsiniz.',
    completeSummaryTitle: 'Xülasə',
    completeSummaryName: 'Restoran',
    completeSummaryCurrency: 'Valyuta',
    completeSummaryTables: 'Masalar',
    completeSummaryProducts: 'Məhsullar',
  },
  en: {
    stepLabel: (current, total) => `Step ${current}/${total}`,
    nextButton: 'Next',
    backButton: 'Back',
    finishButton: 'Finish setup',
    goToAdminButton: 'Go to management panel',
    genericSaveError: (msg) => msg || 'Could not save. Please try again.',
    signOutLink: 'Want to continue with a different account? Sign out.',

    infoStepTitle: 'Restaurant info',
    infoStepSubtitle: 'Confirm your restaurant name and a short tagline.',
    restaurantNameFieldLabel: 'Restaurant name',
    restaurantNameFieldPlaceholder: 'e.g. Garden Restaurant',
    restaurantNameRequired: 'Restaurant name cannot be empty.',
    taglineFieldLabel: 'Tagline (optional)',
    taglineFieldPlaceholder: 'e.g. Digital QR Menu System',

    brandingStepTitle: 'Branding',
    brandingStepSubtitle: "Add a link to your logo — it'll appear on the customer menu and the management panel header. You can skip this step.",
    logoUrlFieldLabel: 'Logo URL',
    logoUrlFieldPlaceholder: 'https://...',
    logoPreviewLabel: 'Preview:',
    logoEmptyHint: "If you don't add a logo, the panel will show the first letter of your restaurant name instead.",

    languageStepTitle: 'Panel language',
    languageStepSubtitle: 'Which language would you like to use for the management panel? You can change this anytime.',

    currencyStepTitle: 'Currency',
    currencyStepSubtitle: 'Which currency should prices on your menu be shown in?',
    currencyOtherFieldPlaceholder: 'Other',
    currencyFieldHint: 'This symbol will appear next to every price (e.g. $25).',

    contactStepTitle: 'Contact info',
    contactStepSubtitle: 'How can customers and your team reach you? Optional — you can fill this in later too.',
    phoneFieldLabel: 'Phone number',
    phoneFieldPlaceholder: '+994 XX XXX XX XX',
    addressFieldLabel: 'Address',
    addressFieldPlaceholder: "Your restaurant's address",

    tablesStepTitle: 'Tables',
    tablesStepSubtitle: (count) => `We've already set up ${count} tables for you. Rename them to match your real tables if you like — the rest can be managed from the "Tables" section in the Admin panel.`,
    tablesEmptyHint: 'No tables found. Manage tables from the "Tables" section in the Admin panel.',
    tableNumberLabel: (n) => `Table ${n}`,
    tablesLoadingHint: 'Loading tables…',

    menuStepTitle: 'Initial menu',
    menuStepSubtitle: "Add at least one category and product — you can always keep going from the Admin panel later.",
    categoryNameFieldPlaceholder: 'e.g. Main courses',
    addCategoryButton: 'Add category',
    productNameFieldPlaceholder: 'e.g. Adana Kebab',
    productPriceFieldLabel: 'Price',
    addProductButton: 'Add product',
    menuNeedsCategoryHint: 'Create at least one category first to add a product.',
    menuEmptyOkHint: 'The menu can stay empty for now — add items anytime from the "Menu" section in the Admin panel.',

    designStepTitle: 'Design',
    designStepSubtitle: 'Choose the primary colors for your customer-facing menu.',
    primaryColorFieldLabel: 'Primary color',
    secondaryColorFieldLabel: 'Secondary color',
    designPreviewLabel: 'Preview',
    designPreviewButtonText: 'Add to cart',

    completeTitle: 'Setup complete!',
    completeBody: 'Your restaurant is ready. You can now go to your management panel to manage your menu, tables, and orders.',
    completeSummaryTitle: 'Summary',
    completeSummaryName: 'Restaurant',
    completeSummaryCurrency: 'Currency',
    completeSummaryTables: 'Tables',
    completeSummaryProducts: 'Products',
  },
  ru: {
    stepLabel: (current, total) => `Шаг ${current}/${total}`,
    nextButton: 'Далее',
    backButton: 'Назад',
    finishButton: 'Завершить настройку',
    goToAdminButton: 'Перейти в панель управления',
    genericSaveError: (msg) => msg || 'Не удалось сохранить. Попробуйте снова.',
    signOutLink: 'Хотите продолжить с другим аккаунтом? Выйдите.',

    infoStepTitle: 'Информация о ресторане',
    infoStepSubtitle: 'Подтвердите название ресторана и краткий слоган.',
    restaurantNameFieldLabel: 'Название ресторана',
    restaurantNameFieldPlaceholder: 'напр. Ресторан «Сад»',
    restaurantNameRequired: 'Название ресторана не может быть пустым.',
    taglineFieldLabel: 'Слоган (необязательно)',
    taglineFieldPlaceholder: 'напр. Цифровая система QR-меню',

    brandingStepTitle: 'Брендинг',
    brandingStepSubtitle: 'Добавьте ссылку на ваш логотип — он будет отображаться в меню клиента и в шапке панели управления. Этот шаг можно пропустить.',
    logoUrlFieldLabel: 'URL логотипа',
    logoUrlFieldPlaceholder: 'https://...',
    logoPreviewLabel: 'Предпросмотр:',
    logoEmptyHint: 'Если вы не добавите логотип, в панели будет показана первая буква названия ресторана.',

    languageStepTitle: 'Язык панели',
    languageStepSubtitle: 'На каком языке вы хотите использовать панель управления? Вы можете изменить это в любое время.',

    currencyStepTitle: 'Валюта',
    currencyStepSubtitle: 'В какой валюте показывать цены в меню?',
    currencyOtherFieldPlaceholder: 'Другое',
    currencyFieldHint: 'Этот символ будет отображаться рядом с каждой ценой (напр. 25 ₼).',

    contactStepTitle: 'Контактная информация',
    contactStepSubtitle: 'Как клиенты и ваша команда могут с вами связаться? Необязательно — можно заполнить позже.',
    phoneFieldLabel: 'Номер телефона',
    phoneFieldPlaceholder: '+994 XX XXX XX XX',
    addressFieldLabel: 'Адрес',
    addressFieldPlaceholder: 'Адрес вашего ресторана',

    tablesStepTitle: 'Столы',
    tablesStepSubtitle: (count) => `Для вас уже подготовлено ${count} столов. При желании переименуйте их в соответствии с реальными столами — остальным можно управлять в разделе «Столы» панели администратора.`,
    tablesEmptyHint: 'Столы не найдены. Управляйте столами в разделе «Столы» панели администратора.',
    tableNumberLabel: (n) => `Стол ${n}`,
    tablesLoadingHint: 'Загрузка столов…',

    menuStepTitle: 'Первоначальное меню',
    menuStepSubtitle: 'Добавьте хотя бы одну категорию и товар — продолжить можно в любое время из панели администратора.',
    categoryNameFieldPlaceholder: 'напр. Основные блюда',
    addCategoryButton: 'Добавить категорию',
    productNameFieldPlaceholder: 'напр. Кебаб Адана',
    productPriceFieldLabel: 'Цена',
    addProductButton: 'Добавить товар',
    menuNeedsCategoryHint: 'Сначала создайте хотя бы одну категорию, чтобы добавить товар.',
    menuEmptyOkHint: 'Меню пока может оставаться пустым — добавить позиции можно в любое время в разделе «Меню» панели администратора.',

    designStepTitle: 'Дизайн',
    designStepSubtitle: 'Выберите основные цвета для меню клиента.',
    primaryColorFieldLabel: 'Основной цвет',
    secondaryColorFieldLabel: 'Дополнительный цвет',
    designPreviewLabel: 'Предпросмотр',
    designPreviewButtonText: 'Добавить в корзину',

    completeTitle: 'Настройка завершена!',
    completeBody: 'Ваш ресторан готов. Теперь вы можете перейти в панель управления, чтобы управлять меню, столами и заказами.',
    completeSummaryTitle: 'Итоги',
    completeSummaryName: 'Ресторан',
    completeSummaryCurrency: 'Валюта',
    completeSummaryTables: 'Столы',
    completeSummaryProducts: 'Товары',
  },
};

export const useOnboardingTranslation = createTranslationHook(onboarding);
