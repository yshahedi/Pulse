function Base(action, req) {
    let db = 'base.db';

    // 1. Centralized Schema Definition (White-lists & Type Mapping)

    const FK_MAP = {
        'organization_id_fk': { table: 'organization_tab', fields: ['name'] },
        'customer_id_fk': { table: 'organization_tab', fields: ['name'] },
        'module_id_fk': { table: 'module_tab', fields: ['name'] },
        'user_id_fk': { table: 'user_tab', fields: ['username'] },
        'approval_id_fk': { table: 'approval_tab', fields: ['title'] },
        'approval_template_id_fk': { table: 'approval_template_tab', fields: ['name'] },
        'country_id_fk': { table: 'country_tab', fields: ['name'] },
        'person_id_fk': { table: 'person_tab', fields: ['name'] },
        'status_id_fk': { table: 'status_tab', fields: ['name'] },
        'default_group_id_fk': { table: 'user_group_tab', fields: ['name'] },
        'user_group_id_fk': { table: 'user_group_tab', fields: ['name'] },
        //  'authentication_policy_id_fk': { table: 'authentication_policy_tab', fields: ['name'] },
        'default_organization_id_fk': { table: 'organization_tab', fields: ['name'] }
    };

    const ALLOWED_COLUMNS = {
        active_approval_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'is_active': 'number',
            'logo_svg': 'string',
            'module_id_fk': 'number',
            'name': 'string',
            'object_name': 'string',
            'organization_id_fk': 'number',
            'rule_description': 'string',
            'update_at': 'datetime'
        },
        active_characteristic_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'is_active': 'number',
            'module_id_fk': 'number',
            'name': 'string',
            'object_name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        active_history_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'fields_description': 'string',
            'id': 'number',
            'is_active': 'number',
            'module_id_fk': 'number',
            'name': 'string',
            'object_name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        alignment_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        approval_history_tab: {
            'approval_id_fk': 'number',
            'approval_template_detail_id_fk': 'number',
            'approval_template_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'event_date': 'datetime',
            'id': 'number',
            'is_approve': 'number',
            'object_id_fk': 'number',
            'organization_id_fk': 'number',
            'update_at': 'datetime',
            'user_id_fk': 'number'
        },
        approval_tab: {
            'approval_template_id_fk': 'number',
            'attend_count': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'object_id': 'number',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        approval_template_detail_tab: {
            'approval_template_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'document_id_fk': 'number',
            'has_signature': 'number',
            'has_stamp': 'number',
            'id': 'number',
            'order': 'number',
            'organization_id_fk': 'number',
            'position_id': 'string',
            'print_id_fk': 'number',
            'update_at': 'datetime',
            'user_id': 'string'
        },
        approval_template_rule_tab: {
            'active_approval_id_fk': 'number',
            'approval_template_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'object_id_1': 'number',
            'object_id_2': 'number',
            'object_id_3': 'number',
            'organization_id_fk': 'number',
            'update_at': 'datetime',
            'value_1': 'string',
            'value_2': 'string'
        },
        approval_template_tab: {
            'active_approval_id_fk': 'number',
            'approve_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'reject_id_fk': 'number',
            'update_at': 'datetime'
        },
        bug_report_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'organization_id_fk': 'number',
            'page_name': 'string',
            'register_date': 'datetime',
            'register_user_id_fk': 'number',
            'response': 'string',
            'response_date': 'datetime',
            'response_user_id_fk': 'number',
            'status_id_fk': 'number',
            'title': 'string',
            'update_at': 'datetime'
        },
        calculation_type_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        calendar_day_tab: {
            'calendar_id_fk': 'number',
            'create_at': 'datetime',
            'custom_recurrence_id_fk': 'number',
            'customer_id_fk': 'number',
            'cycle_type_id_fk': 'number',
            'day_type_id_fk': 'number',
            'day_type_value': 'number',
            'from_date': 'datetime',
            'id': 'number',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        calendar_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'from_time': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'thru_time': 'string',
            'update_at': 'datetime'
        },
        characteristic_config_list_tab: {
            'characteristic_config_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'data_type_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'is_has_value': 'number',
            'is_value_mandatory': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime',
            'validation_function': 'string'
        },
        characteristic_config_tab: {
            'active_characteristic_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'data_type_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'is_has_list': 'number',
            'is_mandatory': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime',
            'validation_function': 'string'
        },
        characteristic_data_tab: {
            'characteristic_config_id_fk': 'number',
            'characteristic_config_list_id_fk': 'number',
            'characteristic_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'organization_id_fk': 'number',
            'update_at': 'datetime',
            'value': 'string'
        },
        characteristic_tab: {
            'active_characteristic_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'object_id': 'number',
            'organization_id_fk': 'number',
            'register_date': 'datetime',
            'update_at': 'datetime',
            'user_id_fk': 'number'
        },
        config_template_component_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'is_invisible': 'number',
            'is_mandatory': 'number',
            'is_optional': 'number',
            'is_readonly': 'number',
            'organization_config_template_id_fk': 'number',
            'organization_id_fk': 'number',
            'uid': 'string',
            'update_at': 'datetime'
        },
        contact_mechanism_purpose_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'mechanism_id_fk': 'number',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        contact_mechanism_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        continent_tab: {
            'code': 'string',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        country_tab: {
            'alpha2_code': 'string',
            'alpha3_code': 'string',
            'code': 'string',
            'continent_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'iso_3166_sub_code': 'string',
            'logo_svg': 'string',
            'name': 'string',
            'nationality_description': 'string',
            'organization_id_fk': 'number',
            'postal_code_regex': 'string',
            'telecom_code': 'string',
            'update_at': 'datetime'
        },
        country_union_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        currency_symbol_placement_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        custom_recurrence_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'cycle_type_id_fk': 'number',
            'date': 'datetime',
            'description': 'string',
            'ends_type_id_fk': 'number',
            'from_time': 'string',
            'id': 'number',
            'is_holiday': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'occurrence_count': 'number',
            'organization_id_fk': 'number',
            'repeat_every': 'number',
            'thru_time': 'string',
            'update_at': 'datetime'
        },
        cycle_type_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'is_system': 'number',
            'logo_svg': 'string',
            'max_value': 'string',
            'min_value': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        data_type_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        day_type_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'from_time': 'string',
            'id': 'number',
            'is_holiday': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'thru_time': 'string',
            'update_at': 'datetime'
        },
        ends_type_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        error_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'module_id_fk': 'number',
            'organization_id_fk': 'number',
            'term_id_fk': 'number',
            'update_at': 'datetime'
        },
        facility_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'faclity_type_id_fk': 'number',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'party_id_fk': 'number',
            'update_at': 'datetime'
        },
        facility_type_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        font_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'font_group': 'string',
            'font_name': 'string',
            'id': 'number',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        geographical_division_data_tab: {
            'country_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'geographical_type_id_fk': 'number',
            'grade': 'string',
            'id': 'number',
            'is_center': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'parent_id_fk': 'number',
            'update_at': 'datetime'
        },
        geographical_division_tab: {
            'country_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'geographical_division_type_id_fk': 'number',
            'id': 'number',
            'is_system': 'number',
            'organization_id_fk': 'number',
            'parent_id_fk': 'number',
            'update_at': 'datetime'
        },
        geographical_division_type_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'is_mandatory': 'number',
            'is_system': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        identity_config_list_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'data_type_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'identity_config_id_fk': 'number',
            'is_has_value': 'number',
            'is_value_mandatory': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime',
            'validation_function': 'string'
        },
        identity_config_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'data_type_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'identity_type_id_fk': 'number',
            'is_has_list': 'number',
            'is_mandatory': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime',
            'validation_function': 'string'
        },
        identity_data_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'identity_config_id_fk': 'number',
            'identity_config_list_id_fk': 'number',
            'identity_id_fk': 'number',
            'identity_type_id_fk': 'number',
            'organization_id_fk': 'number',
            'update_at': 'datetime',
            'value': 'string'
        },
        identity_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'expire_date': 'string',
            'from_date': 'string',
            'id': 'number',
            'identity_type_id_fk': 'number',
            'is_active': 'number',
            'issue_date': 'string',
            'organization_id_fk': 'number',
            'party_id_fk': 'number',
            'party_relationship_id_fk': 'number',
            'thru_date': 'string',
            'update_at': 'datetime'
        },
        identity_type_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'party_type_id_fk': 'number',
            'update_at': 'datetime'
        },
        language_direction_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        language_font_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'font_id_fk': 'number',
            'id': 'number',
            'language_id_fk': 'number',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        language_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'default_country_id_fk': 'number',
            'family': 'string',
            'font_id_fk': 'number',
            'id': 'number',
            'is_active': 'number',
            'iso_639_1': 'string',
            'iso_639_2': 'string',
            'language_direction_id_fk': 'number',
            'name': 'string',
            'native_name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        legal_notice_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'license_type_id_fk': 'number',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        license_type_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        measure_system_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        measure_unit_category_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        measure_unit_tab: {
            'base_measure_unit_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'formula_function': 'string',
            'id': 'number',
            'is_base': 'number',
            'is_countable': 'number',
            'measure_system_id_fk': 'number',
            'measure_unit_category_id_fk': 'number',
            'name': 'string',
            'organization_id_fk': 'number',
            'rounding_precision': 'string',
            'symbol': 'string',
            'update_at': 'datetime'
        },
        organization_config_tab: {
            'create_at': 'datetime',
            'currency_symbol_placement_id_fk': 'number',
            'customer_id_fk': 'number',
            'decimal_seperator': 'string',
            'id': 'number',
            'number_seperator': 'string',
            'organization_config_template_id_fk': 'number',
            'organization_id_fk': 'number',
            'ref_organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        organization_config_template_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        organization_party_access_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'organization_id_fk': 'number',
            'organization_type_id_fk': 'number',
            'party_id_fk': 'number',
            'update_at': 'datetime'
        },
        organization_sub_type_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'organization_type_id_fk': 'number',
            'update_at': 'datetime'
        },
        organization_tab: {
            'country_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'economical_number': 'string',
            'id': 'number',
            'name': 'string',
            'national_code': 'string',
            'organization_id_fk': 'number',
            'organization_sub_type_id_fk': 'number',
            'organization_type_id_fk': 'number',
            'parent_id_fk': 'number',
            'party_id_fk': 'number',
            'registration_date': 'datetime',
            'registration_number': 'string',
            'tax_number': 'string',
            'update_at': 'datetime'
        },
        organization_type_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        party_account_tab: {
            'account_number': 'string',
            'account_serial': 'string',
            'bank_party_id_fk': 'number',
            'branch_party_id_fk': 'number',
            'card': 'string',
            'country_id_fk': 'number',
            'create_at': 'datetime',
            'currency_id_fk': 'number',
            'customer_id_fk': 'number',
            'from_date': 'string',
            'iban': 'string',
            'id': 'number',
            'is_active': 'number',
            'is_shared_account': 'number',
            'is_valid': 'number',
            'name': 'string',
            'organization_id_fk': 'number',
            'party_id_fk': 'number',
            'party_role_id_fk': 'number',
            'realtionship_id_fk': 'number',
            'register_date': 'datetime',
            'register_user_id_fk': 'number',
            'sharing_percent': 'string',
            'thru_date': 'string',
            'update_at': 'datetime'
        },
        party_approval_template_tab: {
            'active_approval_id_fk': 'number',
            'approval_template_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'organization_id_fk': 'number',
            'party_id_fk': 'number',
            'update_at': 'datetime'
        },
        party_classification_detail_tab: {
            'class_list_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        party_classification_list_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'party_type_id_fk': 'number',
            'update_at': 'datetime'
        },
        party_classification_tab: {
            'classification_detail_id_fk': 'number',
            'classification_list_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'from_date': 'string',
            'id': 'number',
            'is_active': 'number',
            'organization_id_fk': 'number',
            'party_id_fk': 'number',
            'thru_date': 'string',
            'update_at': 'datetime'
        },
        party_configuration_parameter_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        party_configuration_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'organization_id_fk': 'number',
            'party_configuration_parameter_id_fk': 'number',
            'party_id_fk': 'number',
            'update_at': 'datetime',
            'value_date': 'datetime',
            'value_number': 'string',
            'value_string': 'string'
        },
        party_contact_mechanism_data_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'is_verified': 'number',
            'is_verified_by_admin': 'number',
            'name': 'string',
            'organization_id_fk': 'number',
            'otp': 'string',
            'otp_expire_date': 'datetime',
            'update_at': 'datetime'
        },
        party_contact_mechanism_tab: {
            'contact_mechanism_data_id_fk': 'number',
            'contact_mechanism_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'facility_id_fk': 'number',
            'from_date': 'string',
            'id': 'number',
            'is_active': 'number',
            'is_used': 'number',
            'organization_id_fk': 'number',
            'party_id_fk': 'number',
            'postal_address_id_fk': 'number',
            'relationship_id_fk': 'number',
            'thru_date': 'string',
            'update_at': 'datetime'
        },
        party_currency_exchange_tab: {
            'buy_currency_table_id_fk': 'number',
            'create_at': 'datetime',
            'cross_currency_table_id_fk': 'number',
            'customer_id_fk': 'number',
            'id': 'number',
            'organization_id_fk': 'number',
            'party_id_fk': 'number',
            'sell_currency_table_id_fk': 'number',
            'update_at': 'datetime'
        },
        party_relationship_tab: {
            'country_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'from_date': 'string',
            'id': 'number',
            'is_active': 'number',
            'note': 'string',
            'organization_id_fk': 'number',
            'original_organization_id_fk': 'number',
            'party_id_fk': 'number',
            'party_role_id_fk': 'number',
            'ref_party_id_fk': 'number',
            'thru_date': 'string',
            'update_at': 'datetime'
        },
        party_role_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'is_active': 'number',
            'is_tab_hidden': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'order': 'number',
            'organization_id_fk': 'number',
            'parent_id_fk': 'number',
            'party_role_type_id_fk': 'number',
            'update_at': 'datetime'
        },
        party_role_type_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        party_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'is_used': 'number',
            'organization_id_fk': 'number',
            'party_type_id_fk': 'number',
            'update_at': 'datetime'
        },
        party_type_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        postal_address_tab: {
            'address_text_1': 'string',
            'address_text_2': 'string',
            'address_text_3': 'string',
            'continent_id_fk': 'number',
            'country_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'latitude': 'string',
            'longitude': 'string',
            'organization_id_fk': 'number',
            'postal_code': 'string',
            'update_at': 'datetime'
        },
        postal_geographical_division_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'geographical_division_data_id_fk': 'number',
            'id': 'number',
            'organization_id_fk': 'number',
            'postal_address_id_fk': 'number',
            'update_at': 'datetime'
        },
        register_type_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        status_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'table_name': 'string',
            'text_color': 'string',
            'update_at': 'datetime'
        },
        time_literals_tab: {
            'conversion_factor': 'string',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'is_system': 'number',
            'name': 'string',
            'organization_id_fk': 'number',
            'symbol': 'string',
            'update_at': 'datetime'
        },
        timezone_tab: {
            'country_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'gmt_offset': 'string',
            'id': 'number',
            'organization_id_fk': 'number',
            'timezone': 'string',
            'update_at': 'datetime'
        },
        union_countries_tab: {
            'country_id_fk': 'number',
            'country_union_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        user_customer_access_tab: {
            'access_cusomer_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'customers': 'string',
            'id': 'number',
            'organization_id_fk': 'number',
            'update_at': 'datetime',
            'user_id_fk': 'number'
        },
        user_organization_access_tab: {
            'access_organization_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'organization_id_fk': 'number',
            'update_at': 'datetime',
            'user_id_fk': 'number'
        },
        variable_type_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'logo_svg': 'string',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        user_tab: {
            'authentication_policy_id_fk': 'number',
            'bad_attend': 'number',
            'change_status_date': 'datetime',
            'country_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'default_group_id_fk': 'number',
            'default_organization_id_fk': 'number',
            'id': 'number',
            'is_admin': 'number',
            'is_agent_user': 'number',
            'is_force_password_change': 'number',
            'is_has_access_protected_person': 'number',
            'is_keep_session': 'number',
            'last_login_date': 'datetime',
            'organization_id_fk': 'number',
            'password': 'string',
            'password_creation_date': 'datetime',
            'password_expire_date': 'datetime',
            'status_id_fk': 'number',
            'update_at': 'datetime',
            'username': 'string',
            'valid_from_date': 'datetime',
            'valid_thru_date': 'datetime'
        },
        user_person_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'organization_id_fk': 'number',
            'person_id_fk': 'number',
            'update_at': 'datetime',
            'user_id_fk': 'number'
        },
        user_group_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'is_active': 'number',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        user_token_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'expiry_date': 'datetime',
            'id': 'number',
            'is_active': 'number',
            'organization_id_fk': 'number',
            'token': 'string',
            'update_at': 'datetime',
            'user_id_fk': 'number'
        },
        user_group_member_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'organization_id_fk': 'number',
            'update_at': 'datetime',
            'user_group_id_fk': 'number',
            'user_id_fk': 'number'
        }
    };

    const ALLOWED_OPERATORS = ['=', '!=', '<', '<=', '>', '>=', 'like', 'in', 'not in', 'is', 'is not'];

    // Helper: Validates that an operator is safe
    const isValidOperator = (op) => ALLOWED_OPERATORS.includes(op.toLowerCase().trim());

    const actions = {
        create_data_model: () => {
            Sqlite(db, `CREATE TABLE IF NOT EXISTS active_approval_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    module_id_fk INTEGER DEFAULT NULL,
                    object_name TEXT DEFAULT NULL,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    customer_id_fk INTEGER DEFAULT NULL,
                    rule_description TEXT DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS active_characteristic_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    module_id_fk INTEGER DEFAULT NULL,
                    object_name TEXT DEFAULT NULL,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS active_history_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    module_id_fk INTEGER DEFAULT NULL,
                    object_name TEXT DEFAULT NULL,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    customer_id_fk INTEGER DEFAULT NULL,
                    fields_description TEXT NOT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS alignment_tab (
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS approval_history_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    description TEXT DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    approval_template_id_fk INTEGER NOT NULL,
                    event_date INTEGER NOT NULL,
                    user_id_fk INTEGER NOT NULL,
                    is_approve INTEGER DEFAULT NULL,
                    approval_template_detail_id_fk INTEGER NOT NULL,
                    object_id_fk INTEGER DEFAULT NULL,
                    approval_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS approval_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    approval_template_id_fk INTEGER NOT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    object_id INTEGER DEFAULT NULL,
                    attend_count INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS approval_template_detail_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    description TEXT DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    "order" INTEGER DEFAULT NULL,
                    user_id TEXT,
                    position_id TEXT,
                    approval_template_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    document_id_fk INTEGER DEFAULT NULL,
                    print_id_fk INTEGER DEFAULT NULL,
                    has_signature INTEGER NOT NULL DEFAULT 0,
                    has_stamp INTEGER NOT NULL DEFAULT 0,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS approval_template_rule_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    active_approval_id_fk INTEGER NOT NULL,
                    approval_template_id_fk INTEGER NOT NULL,
                    object_id_1 INTEGER DEFAULT NULL,
                    object_id_2 INTEGER DEFAULT NULL,
                    object_id_3 INTEGER DEFAULT NULL,
                    value_1 REAL DEFAULT NULL,
                    value_2 REAL DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS approval_template_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    description TEXT DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    name TEXT DEFAULT NULL,
                    approve_id_fk INTEGER NOT NULL,
                    reject_id_fk INTEGER NOT NULL,
                    active_approval_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT NOT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS bug_report_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    response TEXT,
                    status_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    register_user_id_fk INTEGER DEFAULT NULL,
                    register_date INTEGER DEFAULT NULL,
                    response_user_id_fk INTEGER DEFAULT NULL,
                    response_date INTEGER DEFAULT NULL,
                    page_name TEXT DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS calculation_type_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS calendar_day_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    calendar_id_fk INTEGER NOT NULL,
                    day_type_id_fk INTEGER DEFAULT NULL,
                    cycle_type_id_fk INTEGER DEFAULT NULL,
                    custom_recurrence_id_fk INTEGER DEFAULT NULL,
                    from_date INTEGER DEFAULT NULL,
                    day_type_value INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS calendar_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    from_time TEXT NOT NULL,
                    thru_time TEXT NOT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS characteristic_config_list_tab (
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    data_type_id_fk INTEGER DEFAULT NULL,
                    is_has_value INTEGER NOT NULL,
                    characteristic_config_id_fk INTEGER DEFAULT NULL,
                    is_value_mandatory INTEGER NOT NULL,
                    logo_svg TEXT,
                    validation_function TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS characteristic_config_tab (
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    data_type_id_fk INTEGER DEFAULT NULL,
                    is_has_list INTEGER NOT NULL DEFAULT 0,
                    is_mandatory INTEGER NOT NULL,
                    validation_function TEXT,
                    logo_svg TEXT,
                    active_characteristic_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS characteristic_data_tab (
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    id INTEGER NOT NULL,
                    characteristic_id_fk INTEGER DEFAULT NULL,
                    characteristic_config_id_fk INTEGER DEFAULT NULL,
                    characteristic_config_list_id_fk INTEGER DEFAULT NULL,
                    value TEXT DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS characteristic_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    active_characteristic_id_fk INTEGER NOT NULL,
                    object_id INTEGER NOT NULL,
                    user_id_fk INTEGER NOT NULL,
                    register_date INTEGER NOT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS config_template_component_tab (
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_config_template_id_fk INTEGER DEFAULT NULL,
                    uid TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    is_invisible INTEGER DEFAULT 0,
                    is_mandatory INTEGER DEFAULT 0,
                    is_readonly INTEGER DEFAULT 0,
                    is_optional INTEGER DEFAULT 0,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS contact_mechanism_purpose_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    name TEXT DEFAULT NULL,
                    description TEXT DEFAULT NULL,
                    mechanism_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS contact_mechanism_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    name TEXT DEFAULT NULL,
                    description TEXT DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS continent_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    code TEXT DEFAULT NULL,
                    logo_svg TEXT,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS country_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    name TEXT NOT NULL,
                    code TEXT NOT NULL,
                    alpha2_code TEXT NOT NULL,
                    alpha3_code TEXT NOT NULL,
                    iso_3166_sub_code TEXT NOT NULL,
                    continent_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    telecom_code TEXT DEFAULT NULL,
                    nationality_description TEXT NOT NULL,
                    postal_code_regex TEXT DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS country_union_tab (
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    logo_svg TEXT NOT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS currency_symbol_placement_tab (
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS custom_recurrence_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    cycle_type_id_fk INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    repeat_every INTEGER NOT NULL,
                    ends_type_id_fk INTEGER NOT NULL,
                    date INTEGER DEFAULT NULL,
                    occurrence_count INTEGER DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    is_holiday INTEGER NOT NULL DEFAULT 0,
                    from_time TEXT DEFAULT NULL,
                    thru_time TEXT DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS cycle_type_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    min_value TEXT NOT NULL,
                    max_value TEXT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    is_system INTEGER NOT NULL DEFAULT 0,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS data_type_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT DEFAULT NULL,
                    description TEXT DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS day_type_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    is_holiday INTEGER DEFAULT NULL,
                    from_time TEXT DEFAULT NULL,
                    thru_time TEXT DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS ends_type_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS error_tab (
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    id INTEGER NOT NULL,
                    term_id_fk INTEGER NOT NULL,
                    module_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS facility_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    faclity_type_id_fk INTEGER NOT NULL,
                    party_id_fk INTEGER NOT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS facility_type_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS font_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT DEFAULT NULL,
                    font_name TEXT DEFAULT NULL,
                    font_group TEXT DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS geographical_division_data_tab (
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    country_id_fk INTEGER DEFAULT NULL,
                    geographical_type_id_fk INTEGER DEFAULT NULL,
                    parent_id_fk INTEGER DEFAULT NULL,
                    grade TEXT DEFAULT NULL,
                    is_center INTEGER DEFAULT 0,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS geographical_division_tab (
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    id INTEGER NOT NULL,
                    geographical_division_type_id_fk INTEGER DEFAULT NULL,
                    country_id_fk INTEGER DEFAULT NULL,
                    is_system INTEGER DEFAULT 0,
                    parent_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS geographical_division_type_tab (
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    logo_svg TEXT NOT NULL,
                    is_mandatory INTEGER NOT NULL DEFAULT 1,
                    is_system INTEGER DEFAULT 0,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS identity_config_list_tab (
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    data_type_id_fk INTEGER DEFAULT NULL,
                    is_has_value INTEGER NOT NULL,
                    identity_config_id_fk INTEGER DEFAULT NULL,
                    is_value_mandatory INTEGER NOT NULL,
                    logo_svg TEXT,
                    validation_function TEXT NOT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS identity_config_tab (
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    id INTEGER NOT NULL,
                    identity_type_id_fk INTEGER DEFAULT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    data_type_id_fk INTEGER DEFAULT NULL,
                    is_has_list INTEGER NOT NULL DEFAULT 0,
                    is_mandatory INTEGER NOT NULL,
                    validation_function TEXT,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS identity_data_tab (
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    id INTEGER NOT NULL,
                    identity_id_fk INTEGER DEFAULT NULL,
                    identity_type_id_fk INTEGER DEFAULT NULL,
                    identity_config_id_fk INTEGER DEFAULT NULL,
                    identity_config_list_id_fk INTEGER DEFAULT NULL,
                    value TEXT DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS identity_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    party_id_fk INTEGER DEFAULT NULL,
                    identity_type_id_fk INTEGER DEFAULT NULL,
                    party_relationship_id_fk INTEGER DEFAULT NULL,
                    from_date TEXT DEFAULT NULL,
                    thru_date TEXT DEFAULT NULL,
                    issue_date TEXT DEFAULT NULL,
                    expire_date TEXT DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    is_active INTEGER NOT NULL DEFAULT 0,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS identity_type_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT DEFAULT NULL,
                    description TEXT DEFAULT NULL,
                    party_type_id_fk INTEGER NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS language_direction_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT DEFAULT NULL,
                    description TEXT DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS language_font_tab (
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    id INTEGER NOT NULL,
                    language_id_fk INTEGER DEFAULT NULL,
                    font_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS language_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    family TEXT DEFAULT NULL,
                    default_country_id_fk INTEGER DEFAULT NULL,
                    name TEXT DEFAULT NULL,
                    native_name TEXT DEFAULT NULL,
                    iso_639_1 TEXT DEFAULT NULL,
                    iso_639_2 TEXT DEFAULT NULL,
                    language_direction_id_fk INTEGER DEFAULT NULL,
                    font_id_fk INTEGER DEFAULT NULL,
                    is_active INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS legal_notice_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    name TEXT DEFAULT NULL,
                    description TEXT,
                    license_type_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS license_type_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    name TEXT DEFAULT NULL,
                    description TEXT DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS measure_system_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS measure_unit_category_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS measure_unit_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    measure_system_id_fk INTEGER DEFAULT NULL,
                    measure_unit_category_id_fk INTEGER NOT NULL DEFAULT 1,
                    name TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    is_base INTEGER DEFAULT NULL,
                    base_measure_unit_id_fk INTEGER DEFAULT NULL,
                    is_countable INTEGER NOT NULL DEFAULT 1,
                    rounding_precision REAL NOT NULL,
                    formula_function TEXT,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS organization_config_tab (
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    id INTEGER NOT NULL,
                    currency_symbol_placement_id_fk INTEGER DEFAULT NULL,
                    number_seperator TEXT NOT NULL,
                    decimal_seperator TEXT NOT NULL,
                    ref_organization_id_fk INTEGER DEFAULT NULL,
                    organization_config_template_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS organization_config_template_tab (
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    id INTEGER NOT NULL,
                    name TEXT DEFAULT NULL,
                    description TEXT DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS organization_party_access_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_id_fk INTEGER NOT NULL,
                    party_id_fk INTEGER NOT NULL,
                    organization_type_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS organization_sub_type_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT DEFAULT NULL,
                    description TEXT DEFAULT NULL,
                    organization_type_id_fk INTEGER DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS organization_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    party_id_fk INTEGER NOT NULL,
                    organization_sub_type_id_fk INTEGER DEFAULT NULL,
                    tax_number TEXT DEFAULT NULL,
                    registration_number TEXT DEFAULT NULL,
                    national_code TEXT DEFAULT NULL,
                    parent_id_fk INTEGER DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    economical_number TEXT DEFAULT NULL,
                    registration_date INTEGER DEFAULT NULL,
                    country_id_fk INTEGER DEFAULT NULL,
                    organization_type_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS organization_type_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT DEFAULT NULL,
                    description TEXT DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS party_account_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT DEFAULT NULL,
                    country_id_fk INTEGER DEFAULT NULL,
                    currency_id_fk INTEGER DEFAULT NULL,
                    party_id_fk INTEGER DEFAULT NULL,
                    party_role_id_fk INTEGER DEFAULT NULL,
                    realtionship_id_fk INTEGER DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    account_number TEXT DEFAULT NULL,
                    account_serial TEXT DEFAULT NULL,
                    iban TEXT DEFAULT NULL,
                    bank_party_id_fk INTEGER DEFAULT NULL,
                    branch_party_id_fk INTEGER DEFAULT NULL,
                    sharing_percent REAL DEFAULT NULL,
                    is_shared_account INTEGER DEFAULT NULL,
                    card TEXT DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    is_valid INTEGER NOT NULL DEFAULT 1,
                    from_date TEXT DEFAULT NULL,
                    thru_date TEXT DEFAULT NULL,
                    register_date INTEGER DEFAULT NULL,
                    register_user_id_fk INTEGER DEFAULT NULL,
                    is_active INTEGER NOT NULL DEFAULT 0,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS party_approval_template_tab (
                    id INTEGER NOT NULL,
                    party_id_fk INTEGER NOT NULL,
                    active_approval_id_fk INTEGER NOT NULL,
                    approval_template_id_fk INTEGER NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS party_classification_detail_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT DEFAULT NULL,
                    description TEXT DEFAULT NULL,
                    class_list_id_fk INTEGER DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS party_classification_list_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT DEFAULT NULL,
                    description TEXT DEFAULT NULL,
                    party_type_id_fk INTEGER DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS party_classification_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    party_id_fk INTEGER DEFAULT NULL,
                    classification_list_id_fk INTEGER DEFAULT NULL,
                    classification_detail_id_fk INTEGER DEFAULT 'NULL COMMENT ',
                    from_date TEXT DEFAULT NULL,
                    thru_date TEXT DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    is_active INTEGER NOT NULL DEFAULT 0,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS party_configuration_parameter_tab (
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS party_configuration_tab (
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    id INTEGER NOT NULL,
                    party_id_fk INTEGER DEFAULT NULL,
                    value_number REAL DEFAULT NULL,
                    value_string TEXT DEFAULT NULL,
                    value_date INTEGER DEFAULT NULL,
                    party_configuration_parameter_id_fk INTEGER NOT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS party_contact_mechanism_data_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    otp TEXT DEFAULT NULL,
                    otp_expire_date INTEGER DEFAULT NULL,
                    is_verified INTEGER NOT NULL DEFAULT 0,
                    is_verified_by_admin INTEGER NOT NULL DEFAULT 0,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS party_contact_mechanism_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    from_date TEXT DEFAULT NULL,
                    thru_date TEXT DEFAULT NULL,
                    relationship_id_fk INTEGER DEFAULT NULL,
                    party_id_fk INTEGER NOT NULL,
                    contact_mechanism_id_fk INTEGER DEFAULT NULL,
                    facility_id_fk INTEGER DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    contact_mechanism_data_id_fk INTEGER DEFAULT NULL,
                    description TEXT DEFAULT NULL,
                    is_used INTEGER NOT NULL DEFAULT 0,
                    is_active INTEGER NOT NULL DEFAULT 0,
                    postal_address_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS party_currency_exchange_tab (
                    id INTEGER NOT NULL,
                    party_id_fk INTEGER NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    buy_currency_table_id_fk INTEGER DEFAULT NULL,
                    sell_currency_table_id_fk INTEGER DEFAULT NULL,
                    cross_currency_table_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS party_relationship_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    party_role_id_fk INTEGER DEFAULT NULL,
                    party_id_fk INTEGER DEFAULT NULL,
                    country_id_fk INTEGER DEFAULT NULL,
                    ref_party_id_fk INTEGER NOT NULL DEFAULT 1,
                    from_date TEXT DEFAULT NULL,
                    thru_date TEXT DEFAULT NULL,
                    is_active INTEGER DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    note TEXT,
                    original_organization_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS party_role_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT DEFAULT NULL,
                    description TEXT DEFAULT NULL,
                    parent_id_fk INTEGER DEFAULT NULL,
                    party_role_type_id_fk INTEGER DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    is_tab_hidden INTEGER NOT NULL DEFAULT 0,
                    "order" INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS party_role_type_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT DEFAULT NULL,
                    description TEXT DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS party_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    party_type_id_fk INTEGER DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    description TEXT DEFAULT NULL,
                    is_used INTEGER DEFAULT 0,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS party_type_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT DEFAULT NULL,
                    description TEXT DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS postal_address_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    continent_id_fk INTEGER DEFAULT NULL,
                    country_id_fk INTEGER DEFAULT NULL,
                    postal_code TEXT NOT NULL,
                    latitude REAL DEFAULT NULL,
                    longitude REAL DEFAULT NULL,
                    address_text_1 TEXT NOT NULL,
                    address_text_2 TEXT DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    address_text_3 TEXT DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS postal_geographical_division_tab (
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    id INTEGER NOT NULL,
                    postal_address_id_fk INTEGER NOT NULL,
                    geographical_division_data_id_fk INTEGER NOT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS register_type_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS status_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    table_name TEXT DEFAULT NULL,
                    name TEXT DEFAULT NULL,
                    text_color TEXT DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT NOT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS time_literals_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    is_system INTEGER NOT NULL DEFAULT 0,
                    symbol TEXT NOT NULL,
                    conversion_factor REAL DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS timezone_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    country_id_fk INTEGER NOT NULL,
                    timezone TEXT NOT NULL,
                    gmt_offset TEXT DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS union_countries_tab (
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    id INTEGER NOT NULL,
                    country_union_id_fk INTEGER DEFAULT NULL,
                    country_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS user_customer_access_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    user_id_fk INTEGER NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    customers TEXT,
                    access_cusomer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS user_organization_access_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    user_id_fk INTEGER NOT NULL,
                    access_organization_id_fk INTEGER NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS variable_type_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    logo_svg TEXT,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS user_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    username TEXT NOT NULL,
                    password TEXT DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    bad_attend INTEGER DEFAULT 0,
                    change_status_date INTEGER DEFAULT NULL,
                    valid_from_date INTEGER DEFAULT NULL,
                    valid_thru_date INTEGER DEFAULT NULL,
                    last_login_date INTEGER DEFAULT NULL,
                    password_creation_date INTEGER DEFAULT NULL,
                    password_expire_date INTEGER DEFAULT NULL,
                    is_force_password_change INTEGER DEFAULT 0,
                    is_keep_session INTEGER DEFAULT 0,
                    status_id_fk INTEGER DEFAULT NULL,
                    default_group_id_fk INTEGER DEFAULT NULL,
                    authentication_policy_id_fk INTEGER DEFAULT NULL,
                    is_admin INTEGER DEFAULT 0,
                    is_agent_user INTEGER DEFAULT 0,
                    default_organization_id_fk INTEGER DEFAULT NULL,
                    country_id_fk INTEGER DEFAULT NULL,
                    is_has_access_protected_person INTEGER DEFAULT 0,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS user_person_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    user_id_fk INTEGER NOT NULL,
                    person_id_fk INTEGER DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS user_group_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    is_active INTEGER DEFAULT 1,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS user_token_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    user_id_fk INTEGER NOT NULL,
                    token TEXT NOT NULL,
                    is_active INTEGER DEFAULT 1,
                    expiry_date INTEGER DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS user_group_member_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    user_id_fk INTEGER NOT NULL,
                    user_group_id_fk INTEGER NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            return true;
        },

        get_all: (req) => {
            const { name, filters, search, limit, offset, order_fields, order_dir } = req;
            if (!ALLOWED_COLUMNS?.[name]) throw 'Table not found!';

            let selectFields = ['t1.*'];
            let joinSql = '';
            let joinCounter = 0;

            // Dynamically build JOINs and extra fields based on FK_MAP
            Object.keys(ALLOWED_COLUMNS[name]).forEach(col => {
                if (FK_MAP[col]) {
                    joinCounter++;
                    const fk = FK_MAP[col];
                    const alias = `${col}_ref_${joinCounter}`; // Unique alias to prevent duplicate table join errors

                    joinSql += ` LEFT JOIN ${fk.table} AS ${alias} ON t1.${col} = ${alias}.id `;

                    // Add requested foreign fields to SELECT
                    fk.fields.forEach(f => {
                        selectFields.push(`${alias}.${f} AS ${col}_${f}`);
                    });
                }
            });

            let values = [];

            const buildFilterGroup = (group) => {
                if (!group || !group.items || group.items.length === 0) return '';
                const joinStr = (group.join || 'AND').toUpperCase();

                const conditions = group.items.map(item => {
                    // Recursive group
                    if (item.items) return `(${buildFilterGroup(item)})`;

                    // Single condition
                    const { key, operator, value } = item;
                    if (!ALLOWED_COLUMNS[name][key] || !isValidOperator(operator)) return null;

                    const op = operator.toLowerCase();
                    if (op === 'is' || op === 'is not') {
                        return `t1.${key} ${op} NULL`;
                    } else if (op === 'in' || op === 'not in') {
                        if (!Array.isArray(value)) return null;
                        const placeholders = value.map(() => '?').join(',');
                        values.push(...value);
                        return `t1.${key} ${op} (${placeholders})`;
                    } else {
                        values.push(value);
                        return `t1.${key} ${operator} ?`;
                    }
                }).filter(Boolean);

                return conditions.length > 0 ? conditions.join(` ${joinStr} `) : '';
            };

            let whereSql = '';
            const filterSql = buildFilterGroup(filters);
            if (filterSql) whereSql = `(${filterSql})`;

            if (search) {
                const searchConditions = Object.entries(ALLOWED_COLUMNS[name])
                    .map(([col, type]) => {
                        if (type === 'string') {
                            values.push(`%${search}%`);
                            return `t1.${col} LIKE ?`;
                        } else if (type === 'number' && !isNaN(search)) {
                            values.push(Number(search));
                            return `t1.${col} = ?`;
                        }
                        return null;
                    }).filter(Boolean);

                if (searchConditions.length > 0) {
                    whereSql = whereSql ? `${whereSql} AND (${searchConditions.join(' OR ')})` : `(${searchConditions.join(' OR ')})`;
                }
            }

            const finalWhere = whereSql ? `WHERE ${whereSql}` : '';

            // Handle Ordering
            let orderBy = 't1.id';
            if (order_fields?.length) {
                const validOrder = order_fields.filter(f => ALLOWED_COLUMNS[name][f]);
                if (validOrder.length) {
                    const dir = (order_dir || 'ASC').toUpperCase();
                    orderBy = validOrder.map(f => `t1.${f} ${dir}`).join(', ');
                }
            }

            const rowsSql = `
                SELECT ${selectFields.join(', ')} 
                FROM ${name} AS t1 
                ${joinSql} 
                ${finalWhere} 
                ORDER BY ${orderBy} 
                LIMIT ? OFFSET ?
            `;

            const countSql = `SELECT COUNT(*) as total FROM ${name} AS t1 ${finalWhere}`;

            const rows = Sqlite(db, rowsSql, [...values, limit || 10, offset || 0]);
            const totalResult = Sqlite(db, countSql, values);

            return { rows, total_count: totalResult[0]?.total || 0 };
        },

        get: (req) => {
            const name = req?.name;
            const id = req?.id ?? 0;
            if (!ALLOWED_COLUMNS?.[name]) throw 'Table not found!';

            let selectFields = ['t1.*'];
            let joinSql = '';
            let joinCounter = 0;

            Object.keys(ALLOWED_COLUMNS[name]).forEach(col => {
                if (FK_MAP[col]) {
                    joinCounter++;
                    const fk = FK_MAP[col];
                    const alias = `${col}_ref_${joinCounter}`;
                    joinSql += ` LEFT JOIN ${fk.table} AS ${alias} ON t1.${col} = ${alias}.id `;
                    fk.fields.forEach(f => {
                        selectFields.push(`${alias}.${f} AS ${col}_${f}`);
                    });
                }
            });

            const sql = `SELECT ${selectFields.join(', ')} FROM ${name} AS t1 ${joinSql} WHERE t1.id = ?`;
            const result = Sqlite(db, sql, [id]);
            return result[0] || null;
        },
        add: (req) => {
            let name = req?.name;
            if (!ALLOWED_COLUMNS?.[name]) throw 'Table not found!';
            let fields = [];
            let values = [];

            if (req?.record) {
                Object.keys(req.record).forEach(x => {
                    if (ALLOWED_COLUMNS[name][x] && x !== 'id' && x !== 'create_at' && x !== 'update_at') {
                        fields.push(x);
                        values.push(req.record[x]);
                    }
                });
            }

            // Set timestamps
            fields.push('create_at', 'update_at');
            const now = Math.floor(Date.now() / 1000);
            values.push(now, now);

            const sql = `INSERT INTO ${name}(${fields.join(',')}) VALUES(${fields.map(() => '?').join(',')})`;
            Sqlite(db, sql, values);

            return Sqlite(db, `SELECT LAST_INSERT_ROWID() as id;`)?.[0]?.id ?? 0;
        },

        edit: (req) => {
            let name = req?.name;
            if (!ALLOWED_COLUMNS?.[name]) throw 'Table not found!';
            let fields = [];
            let values = [];
            const id = req?.record?.id;

            if (!id) throw "Missing record ID for update.";

            if (req?.record) {
                Object.keys(req.record).forEach(x => {
                    if (ALLOWED_COLUMNS[name][x] && x !== 'id' && x !== 'create_at' && x !== 'update_at') {
                        fields.push(`${x}=?`);
                        values.push(req.record[x]);
                    }
                });
            }

            // Auto-update 'update_at'
            fields.push('update_at=?');
            values.push(Math.floor(Date.now() / 1000));

            values.push(id);
            const sql = `UPDATE ${name} SET ${fields.join(',')} WHERE id=?`;
            Sqlite(db, sql, values);

            return id;
        },

        delete: (req) => {
            let name = req?.name;
            if (!ALLOWED_COLUMNS?.[name]) throw 'Table not found!';
            const id = req?.id ?? 0;
            Sqlite(db, `DELETE FROM ${name} WHERE id=?`, [id]);
            return true;
        },

        seed_admin: () => {
            const now = Math.floor(Date.now() / 1000);

            // Seed active status (id=1) for user_tab if not present
            const statusCheck = Sqlite(db, `SELECT id FROM status_tab WHERE id = 1 LIMIT 1`);
            if (statusCheck.length === 0) {
                Sqlite(db, `INSERT OR IGNORE INTO status_tab (id, table_name, name, logo_svg, create_at, update_at) VALUES (1, 'user_tab', 'Active', '', ?, ?)`, [now, now]);
                Log('seed_admin (base): inserted Active status (id=1).');
            }

            // Idempotent: skip if admin user already exists
            const existingUser = Sqlite(db, `SELECT id FROM user_tab WHERE username = 'ADMIN' LIMIT 1`);
            if (existingUser.length > 0) {
                Log('seed_admin (base): ADMIN user already exists, skipping.');
                return { user_id: existingUser[0].id };
            }

            // Password = MD5('admin123') — matches frontend CryptoJS.MD5 hash
            const adminPassword = '0192023a7bbd73250516f069df18b500';
            Sqlite(db, `INSERT INTO user_tab (username, password, is_admin, status_id_fk, create_at, update_at) VALUES (?, ?, 1, 1, ?, ?)`,
                ['ADMIN', adminPassword, now, now]);
            const userId = Sqlite(db, `SELECT LAST_INSERT_ROWID() as id`)[0].id;
            Log(`seed_admin (base): created ADMIN user (id=${userId}).`);
            return { user_id: userId };
        },

        do_logout: (req) => {
            const token = req?.token;
            if (!token) throw 'Token required for logout';
            const now = Math.floor(Date.now() / 1000);
            Sqlite(db, `UPDATE user_token_tab SET is_active = 0, update_at = ? WHERE token = ?`, [now, token]);
            return true;
        },

        do_login: (req) => {
            const username = req?.username;
            const password = req?.password;
            const organization_id_fk = req?.organization_id_fk ?? 1;

            if (!username || !password) throw 'Username and password required';

            // Query user by username (case-insensitive) and password. Username
            // matching ignores case so 'ADMIN' and 'admin' resolve to the same
            // account; the password is still compared exactly.
            const user = Sqlite(db, `SELECT * FROM user_tab WHERE LOWER(username) = LOWER(?) AND password = ? AND status_id_fk = 1`, [username, password])?.[0];

            if (!user) throw 'Invalid username or password';

            // Generate JWT token (header.payload.signature — base64-encoded parts)
            const header = Base64Encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
            const now = Math.floor(Date.now() / 1000);
            const payload = Base64Encode(JSON.stringify({
                user_id: user.id,
                username: user.username,
                is_admin: user.is_admin === 1,
                organization_id: user.organization_id_fk,
                customer_id: user.customer_id_fk,
                iat: now,
                exp: now + (24 * 60 * 60) // 24 hours expiry
            }));

            // Signature placeholder (DB-lookup enforces authenticity instead)
            const signature = Base64Encode('pulse_signature');
            const token = `${header}.${payload}.${signature}`;

            // Store token in user_token_tab
            const expiry_date = now + (24 * 60 * 60);
            Sqlite(db,
                `INSERT INTO user_token_tab (user_id_fk, token, is_active, expiry_date, organization_id_fk, customer_id_fk, create_at, update_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [user.id, token, 1, expiry_date, user.organization_id_fk, user.customer_id_fk, now, now]
            );

            // Update last_login_date
            Sqlite(db, `UPDATE user_tab SET last_login_date = ? WHERE id = ?`, [now, user.id]);

            return {
                token: token,
                user_id: user.id,
                username: user.username,
                organization_id_fk: user.organization_id_fk,
                customer_id_fk: user.customer_id_fk,
                expiry_date: expiry_date
            };
        }
    };

    let ret;
    let __tx_attempt = 0;
    let __immediate = false;
    for (;;) {
        try {
            Sqlite(db, __immediate ? 'BEGIN IMMEDIATE;' : 'BEGIN TRANSACTION;');
            const fn = actions[action];
            if (!fn) throw `Unknown action: ${action}`;
            ret = fn(req);
            Sqlite(db, 'COMMIT;');
            break;
        }
        catch (e) {
            try { Sqlite(db, 'ROLLBACK;'); } catch (_) { }
            // One SQLite connection per worker: a concurrent writer can cause a
            // transient "database is locked" (WAL write/snapshot conflict). Retry,
            // upgrading to BEGIN IMMEDIATE so the writer grabs the lock up-front
            // (no snapshot conflict). Reads never hit this, so they stay
            // concurrent (deferred); only contended writes pay the cost.
            const __msg = String((e && e.message) || e);
            if (__msg.indexOf('locked') !== -1 && ++__tx_attempt < 50) { __immediate = true; continue; }
            throw (e);
        }
    }

    return ret;
}