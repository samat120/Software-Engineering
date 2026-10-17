async function get_chief(): Promise<void> {
    const aim = await Context.data.payment_aim!.fetch()
    if (aim.data.payee_type) {
        const chiefs = await Context.data.__createdBy.getChiefs()
        Context.data.approver = chiefs[0]
    }
    else {
        const chiefs = await Context.data.payee_employee!.getChiefs()
        Context.data.approver = chiefs[0]
    }
    // if (aim.data.id_required) {
    //     Context.data.invoice_date_string! = Context.data.invoice_date!.format('DD-MM-YYYY')
    // }
}

async function clean_variables(): Promise<void> {
    const tmp = await Context.data.payment_aim!.fetch()
    if (tmp.data.payee_type) {
        Context.data.payee_employee = undefined
    }
    else {
        Context.data.payee_partner = undefined
    }
    if (tmp.data.paymet_reason_type && Context.data.payment_reason_table) {
        for (let i = Context.data.payment_reason_table!.length - 1; i >= 0; i--) {
            Context.data.payment_reason_table!.delete(i)
        }
    }
    else {
        Context.data.payment_reason_file = undefined;
    }
    // if (!tmp.data.id_required) {
    //     Context.data.invoice_date_string = ""
    //     Context.data.invoice_id! = ""
    // }
    // else {
    //     Context.data.invoice_date_string = Context.data.invoice_date!.format('DD-MM-YYYY')
    // }
}

async function define_display_options(): Promise<void> {
    const tmp = await Context.data.payment_aim!.fetch();
    if (!tmp.data.payee_type) {
        Context.data.hide_payee_partner = true;
        Context.data.hide_payee_employee = false;
    }
    else {
        Context.data.hide_payee_partner = false;
        Context.data.hide_payee_employee = true;
    }
    if (!tmp.data.paymet_reason_type) {
        Context.data.hide_payment_reason_table = false;
        Context.data.hide_payment_reason_file = true;
        Context.data.hide_file_preview = true;
    }
    else {
        Context.data.hide_payment_reason_table = true;
        Context.data.hide_payment_reason_file = false;
        Context.data.hide_file_preview = false;
    }
    // if (!tmp.data.id_required) {
    //     Context.data.hide_invoice_id = true;
    //     Context.data.hide_invoice_date = true;
    // }
    // else {
    //     Context.data.hide_invoice_id = false;
    //     Context.data.hide_invoice_date = false;
    // }
}

async function checkPaymentAmount_2(): Promise<boolean> {
    // Получаем сумму платежа из контекста
    const sum_of_payment = Context.data.sum_of_payment!;

    // Загружаем данные валюты напрямую
    const currency = await Context.data.invoice_currency!.fetch();

    // Проверяем значение валюты через данные, возвращённые fetch()
    const currencyValue = currency.data.__name!; // Предполагаем, что currency.data.name содержит название валюты, например "Тенге", "Рубль", "Доллар"

    // Условие проверки лимитов для каждой валюты
    if (
        (currencyValue === "Тенге" && sum_of_payment >= 3500000) ||
        (currencyValue === "Рубль" && sum_of_payment >= 500000) ||
        (currencyValue === "Доллар" && sum_of_payment >= 6000)
    ) {
        // Устанавливаем переключатель в "Да"
        return true;
    } else {
        // Если условия не выполняются, переключатель устанавливается на "Нет"
        return false;
    }
}

// Функция для присвоения Пользователей из Групп и ролей в Зоны отвественности бизнес-процесса
async function getUsersFromGroup(): Promise<void> {
    // 1. Определяем суффикс компании на основе флагов в контексте
    let companySuffix = '';
    if (Context.data.company_a) companySuffix = 'A';
    else if (Context.data.company_b) companySuffix = 'B';
    else if (Context.data.company_c) companySuffix = 'C';
    else if (Context.data.company_d) companySuffix = 'D';
    else if (Context.data.company_e) companySuffix = 'E';

    // Если ни одна компания не выбрана, прерываем выполнение
    if (!companySuffix) {
        return;
    }

    // 2. Запускаем поиск всех 4-х групп параллельно через Promise.all
    const [
        groupVerify,
        groupExecute,
        groupBudget,
        groupFinal
    ] = await Promise.all([
        System.userGroups.search().where(f => f.__name.eq(`Заявки на оплату.Бухгалтер_проверка_${companySuffix}`)).first(),
        System.userGroups.search().where(f => f.__name.eq(`Заявки на оплату.Бухгалтер_исполнение_${companySuffix}`)).first(),
        System.userGroups.search().where(f => f.__name.eq(`Заявки на оплату.Согласующий_по_бюджету_${companySuffix}`)).first(),
        System.userGroups.search().where(f => f.__name.eq(`Заявки на оплату.Утверждающий_${companySuffix}`)).first()
    ]);

    // 3. Также параллельно запрашиваем пользователей из найденных групп
    const [usersVerify, usersExecute, usersBudget, usersFinal] = await Promise.all([
        groupVerify?.users() ?? Promise.resolve([]),
        groupExecute?.users() ?? Promise.resolve([]),
        groupBudget?.users() ?? Promise.resolve([]),
        groupFinal?.users() ?? Promise.resolve([])
    ]);

    // 4. Записываем результат в контекст
    Context.data.payment_accountant = usersVerify;
    Context.data.Executor = usersExecute;
    Context.data.budget_approver = usersBudget;
    Context.data.final_approver = usersFinal;

    // Запись пользователей для рассылки на случай отмены
    Context.data.cancelation_mail_list = Context.data.payment_accountant;
}

async function isChiefAssigned(): Promise<boolean> {
    return !!Context.data.additional_approver;
}

async function checkPaymentAmount_1(): Promise<boolean> {
    // Получаем сумму платежа из контекста
    const sum_of_payment = Context.data.sum_of_payment!;

    // Загружаем (так как это ссылка на другое приложение) данные валюты напрямую
    const currency = await Context.data.invoice_currency!.fetch();

    // Проверяем значение валюты через данные, возвращённые fetch()
    const currencyValue = currency.data.__name!; // Предполагаем, что currency.data.name содержит название валюты, например "Тенге", "Рубль", "Доллар"

    // Условие проверки лимитов для каждой валюты
    if (
        (currencyValue === "Тенге" && sum_of_payment >= 3000000) ||
        (currencyValue === "Рубль" && sum_of_payment >= 460000) ||
        (currencyValue === "Доллар" && sum_of_payment >= 6000)
    ) {
        return true;
    }
    return false;
}

async function addApprover(): Promise<void> {
    // ID группы "Наблюдатели"
    const groupId = '758ca6b7-10ed-5a7e-b9d2-82336754d8ac';
    
    // 1. Ищем группу "Наблюдатели"
    const targetGroup = await System.userGroups.search().where(f => f.__id.eq(groupId)).first();

    if (targetGroup) {
        // 2. Получаем текущий список участников напрямую из данных группы
        // В ELMA365 это обычно массив ссылок (UserItemRef[])
        let currentUsers = targetGroup.data.users || [];

        // 3. Берем новых пользователей из контекста (final_approver — массив ссылок)
        const newApprovers = Context.data.final_approver;

        if (newApprovers && newApprovers.length > 0) {
            // 4. Добавляем новых пользователей к текущим
            // Используем обычный цикл для совместимости
            for (let i = 0; i < newApprovers.length; i++) {
                currentUsers.push(newApprovers[i]);
            }

            // 5. Записываем обновленный массив обратно в поле данных группы
            targetGroup.data.users = currentUsers;

            // 6. Сохраняем сам объект группы
            await targetGroup.save();
        }
    }
}

async function updatePriorityInProcess(): Promise<void> {
    // 1. Проверяем, заполнена ли категория priority
    if (!Context.data.priority) {
        Context.data.priority_1 = undefined;
        return;
    }

    // 2. Получаем системный код выбранного варианта
    const selectedCode = Context.data.priority.code;

    // 3. Пересчитываем числовой приоритет по кодам
    switch (selectedCode) {
        case 'low':
            Context.data.priority_1 = 0;
            break;

        case 'medium':
            Context.data.priority_1 = 50;
            break;

        case 'high':
            Context.data.priority_1 = 100;
            break;

        default:
            // На случай, если код не совпал или добавился новый вариант
            Context.data.priority_1 = undefined;
            break;
    }
}

