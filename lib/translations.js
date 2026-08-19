export const translations = {
  az: {
    activeTable: "Aktiv Masa",
    callWaiter: "Ofisiantı Çağır",
    requestBill: "Hesab İstə",
    allMenu: "Bütün Menyu",
    cart: "Səbət",
    cartTitle: "Sifariş Siyahısı",
    details: "Ətraflı",
    price: "Qiymət",
    activeOrders: "Aktiv Sifarişlərim",
    poweredBy: "Powered by",
    tagline: "Rəqəmsal QR Menyu və İdarəetmə Sistemi",
    yourCart: "Səbətiniz",
    checkout: "Sifarişi Tamamla",
    paymentType: "Ödəniş Növü",
    paymentPrompt: "Hesabı necə ödəmək istəyirsiniz?",
    cash: "💵 Nəğd",
    card: "💳 Kart",
    cancel: "Ləğv et",
    waiterCalled: "Ofisiant çağırıldı!",
    billRequested: "Hesab istənildi!",
    // 0025_order_payment_status.sql — orthogonal to order status (statusPending
    // etc. above): an order can be "Tamamlandı" and still unpaid.
    paidStatus: "Ödənilib",
    unpaidStatus: "Ödənilməyib",
    payLater: "Sonra ödəyəcəyəm",
    nothingToPay: "Ödəniləcək məbləğ yoxdur.",
    // Referenced by CustomerApp's waiter/bill-request error paths but never
    // defined — getLocalizedText() returns the raw key on a miss, so those
    // error toasts literally read "genericError" instead of falling through
    // to their own hardcoded AZ fallback.
    genericError: "Xəta baş verdi.",
    orderSent: "Sifarişiniz Göndərildi!",
    orderSuccessDesc: "üçün sifarişiniz ofisianta və mətbəxə çatdırıldı. Təxmini hazırlanma müddəti: 15-20 dəq.",
    table: "Masa:",
    itemCount: "Məhsul sayı:",
    totalAmount: "Yekun Məbləğ:",
    subtotal: "Ara cəm:",
    serviceFee: "Xidmət haqqı (0%):",
    free: "PULSUZ",
    completeAndNewOrder: "Tamamla və Yeni Sifarişə Keç",
    cartEmpty: "Siyahınız Boşdur",
    cartEmptyDesc: "Menyudan bəyəndiyiniz İtalyan təamlarını seçərək masa sifarişinizə əlavə edin.",
    yourTable: "Oturduğunuz Masa:",
    specialRequestPlaceholder: "Xüsusi istək (istəyə bağlı)...",
    tableNoteLabel: "Ümumi masa qeydi (Ofisiant üçün)",
    tableNotePlaceholder: "Məsələn: Salfet, əlavə çəngəl xahiş olunur...",
    sendToWaiterAndKitchen: "Ofisianta və Mətbəxə Göndər",
    aboutProduct: "Məhsul Haqqında",
    category: "Kateqoriya:",
    prepTime: "Hazırlanma:",
    energy: "Enerji:",
    description: "Təsvir",
    ingredients: "Tərkib & İnqrediyentlər",
    kitchenRequestLabel: "Mətbəx üçün xüsusi istək (İstəyə bağlı)",
    kitchenRequestPlaceholder: "Məsələn: Acısız olsun, sarımsaq əlavə olunmasın...",
    quantity: "Miqdar:",
    addToCart: "Sifarişə Əlavə Et",
    freeOption: "Pulsuz",
    popular: "Populyar",
    chefChoice: "Şefin Seçimi",
    spicy: "Acılı",
    vegetarian: "Veqetarian",
    statusPending: "Qəbul edildi",
    statusPreparing: "Hazırlanır",
    statusCompleted: "Tamamlandı",
    statusCancelled: "Ləğv edilib",
    piece: "ədəd",
    waiterRequestNote: "Ofisiant xahiş olunur",
    billRequestNote: "Hesab istənilir",
    // Added for the full-app localization pass — a handful of strays in
    // CartDrawer.jsx that weren't yet routed through getLocalizedText().
    tableFallbackName: (n) => `Masa ${n}`,
    paymentCancelled: "Ödəniş ləğv edildi.",
    orderSubmitFailed: "Sifarişi göndərmək mümkün olmadı.",
    tableRecordNotFound: (n) => `Masa qeydi tapılmadı (masa №${n}).`,
    productAltFallback: "Məhsul",
    removeItemTitle: "Sil"
  },
  en: {
    activeTable: "Active Table",
    callWaiter: "Call Waiter",
    requestBill: "Request Bill",
    allMenu: "All Menu",
    cart: "Cart",
    cartTitle: "Order List",
    details: "Details",
    price: "Price",
    activeOrders: "My Active Orders",
    poweredBy: "Powered by",
    tagline: "Digital QR Menu & Management System",
    yourCart: "Your Cart",
    checkout: "Complete Order",
    paymentType: "Payment Method",
    paymentPrompt: "How would you like to pay the bill?",
    cash: "💵 Cash",
    card: "💳 Card",
    cancel: "Cancel",
    waiterCalled: "Waiter called!",
    billRequested: "Bill requested!",
    paidStatus: "Paid",
    unpaidStatus: "Unpaid",
    payLater: "I'll pay later",
    nothingToPay: "There's nothing to pay.",
    genericError: "Something went wrong.",
    orderSent: "Order Sent!",
    orderSuccessDesc: "your order has been sent to the waiter and kitchen. Estimated prep time: 15-20 min.",
    table: "Table:",
    itemCount: "Item count:",
    totalAmount: "Total Amount:",
    subtotal: "Subtotal:",
    serviceFee: "Service fee (0%):",
    free: "FREE",
    completeAndNewOrder: "Complete & Start New Order",
    cartEmpty: "Your Cart is Empty",
    cartEmptyDesc: "Choose your favorite Italian dishes from the menu to add to your table order.",
    yourTable: "Your Table:",
    specialRequestPlaceholder: "Special request (optional)...",
    tableNoteLabel: "General table note (For Waiter)",
    tableNotePlaceholder: "For example: Napkins, extra fork requested...",
    sendToWaiterAndKitchen: "Send to Waiter & Kitchen",
    aboutProduct: "About Item",
    category: "Category:",
    prepTime: "Preparation:",
    energy: "Energy:",
    description: "Description",
    ingredients: "Ingredients",
    kitchenRequestLabel: "Special request for kitchen (Optional)",
    kitchenRequestPlaceholder: "For example: Not spicy, no garlic...",
    quantity: "Quantity:",
    addToCart: "Add to Order",
    freeOption: "Free",
    popular: "Popular",
    chefChoice: "Chef's Choice",
    spicy: "Spicy",
    vegetarian: "Vegetarian",
    statusPending: "Accepted",
    statusPreparing: "Preparing",
    statusCompleted: "Completed",
    statusCancelled: "Cancelled",
    piece: "pcs",
    waiterRequestNote: "Waiter requested",
    billRequestNote: "Bill requested",
    tableFallbackName: (n) => `Table ${n}`,
    paymentCancelled: "Payment cancelled.",
    orderSubmitFailed: "Could not submit the order.",
    tableRecordNotFound: (n) => `Table record not found (table #${n}).`,
    productAltFallback: "Item",
    removeItemTitle: "Remove"
  },
  ru: {
    activeTable: "Активный Стол",
    callWaiter: "Вызвать официанта",
    requestBill: "Запросить счет",
    allMenu: "Все меню",
    cart: "Корзина",
    cartTitle: "Список заказов",
    details: "Подробнее",
    price: "Цена",
    activeOrders: "Мои активные заказы",
    poweredBy: "Powered by",
    tagline: "Цифровое QR Меню и Система Управления",
    yourCart: "Ваша корзина",
    checkout: "Оформить заказ",
    paymentType: "Способ оплаты",
    paymentPrompt: "Как вы хотите оплатить счет?",
    cash: "💵 Наличные",
    card: "💳 Карта",
    cancel: "Отмена",
    waiterCalled: "Официант вызван!",
    billRequested: "Счет запрошен!",
    paidStatus: "Оплачено",
    unpaidStatus: "Не оплачено",
    payLater: "Оплачу позже",
    nothingToPay: "Нечего оплачивать.",
    genericError: "Произошла ошибка.",
    orderSent: "Ваш заказ отправлен!",
    orderSuccessDesc: "ваш заказ доставлен официанту и на кухню. Примерное время приготовления: 15-20 мин.",
    table: "Стол:",
    itemCount: "Кол-во товаров:",
    totalAmount: "Итоговая сумма:",
    subtotal: "Подытог:",
    serviceFee: "Обслуживание (0%):",
    free: "БЕСПЛАТНО",
    completeAndNewOrder: "Завершить и новый заказ",
    cartEmpty: "Ваша корзина пуста",
    cartEmptyDesc: "Выберите любимые итальянские блюда из меню, чтобы добавить их к заказу.",
    yourTable: "Ваш стол:",
    specialRequestPlaceholder: "Особые пожелания (необязательно)...",
    tableNoteLabel: "Общее примечание (Для официанта)",
    tableNotePlaceholder: "Например: Салфетки, дополнительная вилка...",
    sendToWaiterAndKitchen: "Отправить официанту и на кухню",
    aboutProduct: "О блюде",
    category: "Категория:",
    prepTime: "Приготовление:",
    energy: "Энергия:",
    description: "Описание",
    ingredients: "Состав и ингредиенты",
    kitchenRequestLabel: "Особые пожелания для кухни (Необязательно)",
    kitchenRequestPlaceholder: "Например: Не острое, без чеснока...",
    quantity: "Количество:",
    addToCart: "Добавить в заказ",
    freeOption: "Бесплатно",
    popular: "Популярное",
    chefChoice: "Выбор шефа",
    spicy: "Острое",
    vegetarian: "Вегетарианское",
    statusPending: "Принят",
    statusPreparing: "Готовится",
    statusCompleted: "Завершен",
    statusCancelled: "Отменён",
    piece: "шт",
    waiterRequestNote: "Вызов официанта",
    billRequestNote: "Запрос счета",
    tableFallbackName: (n) => `Стол ${n}`,
    paymentCancelled: "Оплата отменена.",
    orderSubmitFailed: "Не удалось отправить заказ.",
    tableRecordNotFound: (n) => `Запись стола не найдена (стол №${n}).`,
    productAltFallback: "Блюдо",
    removeItemTitle: "Удалить"
  }
};

export const categoryTranslations = {
  pizza: { en: "Pizzas", ru: "Пицца" },
  main: { en: "Main Dishes", ru: "Главные блюда" },
  salads: { en: "Salads", ru: "Салаты" },
  pasta: { en: "Pastas", ru: "Паста" },
  desserts: { en: "Desserts", ru: "Десерты" },
  drinks: { en: "Drinks", ru: "Напитки" },
  burger: { en: "Burgers", ru: "Бургеры" }
};

export const productTranslations = {
  "p1": {
    en: { name: "Pizza Margherita Classica", description: "San Marzano tomato sauce, fresh Mozzarella Fior di Latte, basil and virgin olive oil." },
    ru: { name: "Пицца Маргарита Классика", description: "Томатный соус Сан-Марцано, свежая Моцарелла Фьор ди Латте, базилик и оливковое масло." }
  },
  "p2": {
    en: { name: "Pizza Pepperoni Piccante", description: "Spicy Italian Pepperoni, San Marzano tomato sauce, Mozzarella and oregano." },
    ru: { name: "Пицца Пепперони Пикканте", description: "Острая итальянская Пепперони, томатный соус Сан-Марцано, Моцарелла и орегано." }
  },
  "p3": {
    en: { name: "Pizza Quattro Formaggi", description: "Gorgonzola DOP, Fontina, Parmigiano Reggiano 24 months, Fior di Latte Mozzarella and truffle honey." },
    ru: { name: "Пицца Четыре Сыра", description: "Горгонзола DOP, Фонтина, Пармезан 24 мес., Моцарелла Фьор ди Латте и трюфельный мед." }
  },
  "m1": {
    en: { name: "Filetto di Manzo con Tartufo", description: "Aged beef tenderloin steak with black truffle sauce, rosemary potatoes and grilled vegetables." },
    ru: { name: "Стейк Филе Миньон с Трюфелем", description: "Выдержанный стейк из говяжьей вырезки с соусом из черного трюфеля, розмариновым картофелем и овощами гриль." }
  },
  "m2": {
    en: { name: "Salmon Grill con Pesto", description: "Atlantic salmon fillet on grill with basil pesto, asparagus and lemon cream sauce." },
    ru: { name: "Лосось на Гриле с Песто", description: "Филе атлантического лосося на гриле с базиликовым песто, спаржей и лимонно-сливочным соусом." }
  },
  "s1": {
    en: { name: "Insalata Caprese con Burrata", description: "Fresh creamy Burrata cheese, tomato slices, basil pesto sauce and aged balsamic glaze." },
    ru: { name: "Салат Капрезе с Бурратой", description: "Свежий сливочный сыр Буррата, ломтики томатов, соус песто из базилика и бальзамический глейз." }
  },
  "s2": {
    en: { name: "Caesar Salad con Gamberi", description: "Grilled king prawns, Romaine lettuce, homemade Caesar dressing, Parmesan and crunchy croutons." },
    ru: { name: "Салат Цезарь с Креветками", description: "Обжаренные королевские креветки, салат Ромен, домашний соус Цезарь, Пармезан и хрустящие сухарики." }
  },
  "pa1": {
    en: { name: "Tagliatelle al Tartufo Nero", description: "Fresh Tagliatelle pasta, natural black truffle sauce, Parmigiano Reggiano and butter emulsion." },
    ru: { name: "Тальятелле с Черным Трюфелем", description: "Свежая паста Тальятелле, соус из натурального черного трюфеля, Пармезан и сливочное масло." }
  },
  "pa2": {
    en: { name: "Spaghetti Carbonara Originale", description: "Original Roman recipe: Guanciale, fresh egg yolk, Pecorino Romano cheese and black pepper. NO CREAM!" },
    ru: { name: "Спагетти Карбонара Ориджинале", description: "Оригинальный римский рецепт: Гуанчиале, яичный желток, Пекорино Романо и черный перец. БЕЗ СЛИВОК!" }
  },
  "d1": {
    en: { name: "Classic Tiramisù Veneziano", description: "Original Italian Tiramisu: Savoiardi cookies dipped in espresso, Mascarpone cream and cocoa powder." },
    ru: { name: "Классический Тирамису Венециано", description: "Оригинальный итальянский Тирамису: печенье Савоярди, пропитанное эспрессо, крем Маскарпоне и какао." }
  },
  "d2": {
    en: { name: "Panna Cotta con Frutti di Bosco", description: "Silky smooth vanilla Panna Cotta with fresh forest berries coulis and mint." },
    ru: { name: "Панна Котта с Лесными Ягодами", description: "Шелковистая ванильная Панна Котта с соусом из свежих лесных ягод и мятой." }
  },
  "dr1": {
    en: { name: "Signature Mocktail 'Bella Tramonto'", description: "San Pellegrino aranciata, fresh grapefruit juice, rosemary syrup, pomegranate and ice." },
    ru: { name: "Фирменный Моктейль 'Bella Tramonto'", description: "San Pellegrino аранчата, свежевыжатый грейпфрутовый сок, розмариновый сироп, гранат и лед." }
  },
  "b1": {
    en: { name: "MenuFlow Gourmet Burger", description: "Premium Angus beef, melted Cheddar, caramelized onions and secret sauce." },
    ru: { name: "MenuFlow Гурме Бургер", description: "Премиальная говядина Ангус, расплавленный Чеддер, карамелизованный лук и секретный соус." }
  }
};

export function getLocalizedText(key, lang = 'az') {
  return translations[lang]?.[key] || translations['az']?.[key] || key;
}

export function getLocalizedCategoryName(category, lang = 'az') {
  if (lang === 'az') return category.name;
  return categoryTranslations[category.id]?.[lang] || category.name;
}

export function getLocalizedProduct(product, lang = 'az') {
  if (lang === 'az') return product;
  const trans = productTranslations[product.id]?.[lang];
  if (trans) {
    return {
      ...product,
      name: trans.name || product.name,
      description: trans.description || product.description
    };
  }
  return product;
}
