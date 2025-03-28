const PREC = {
  UNARY: 8,
  EXP: 7,
  MULTI: 6,
  ADD: 5,
  COMPARE: 4,
  LOGICAL: 3,
  ASSIGN: 2,
  EXTRA: -1
};

module.exports = grammar({
  name: "abl",

  externals: ($) => [
    $._namedot,
    $._namecolon,
    $._namedoublecolon,
    $._or_operator,
    $._and_operator,
    $._augmented_assignment,
    $._escaped_string,
    $._input_keyword,
    $._output_keyword,
    $._new_keyword,
    $._old_keyword,
    $._for_keyword,
    $._def_keyword,
    $._var_keyword,
    $._index_keyword,
    $._field_keyword,
    $._special_character
  ],
  extras: ($) => [$.comment, /[\s\f\uFEFF\u2060\u200B]|\\\r?\n/],
  word: ($) => $.identifier,
  supertypes: ($) => [$._expression, $._statement],
  conflicts: ($) => [
    [$.record_phrase],
    [$.sort_clause],
    [$.string_literal],
    [$.if_statement],
    [$._statement, $.if_statement],
    [$._statement, $.on_statement],
  ],

  rules: {
    source_code: ($) => repeat($._statement),

    body: ($) => seq(":", repeat($._statement)),

    dot_body: ($) => seq(choice(":", "."), repeat($._statement)),

    class_body: ($) =>
      seq(
        ":",
        repeat(
          choice(
            $.definition,
            $.var_statement,
            seq(optional($.annotation), $.method_statement),
            $.constructor_statement,
            $.destructor_statement
          )
        )
      ),

    interface_body: ($) =>
      seq(
        ":",
        repeat(
          choice(
            $.definition,
            $.method_statement
          )
        )
      ),

    case_body: ($) =>
      seq(":", repeat1($.case_when_branch), optional($.case_otherwise_branch)),

    enum_body: ($) => seq(":", repeat($.enum_definition)),

    label: ($) => seq($.identifier, ":"),

    _terminator: ($) => /\s*\./i,

    _block_terminator: ($) =>
      seq(
        kw("END"),
        optional(
          choice(
            kw("FUNCTION"),
            kw("PROCEDURE"),
            kw("CASE"),
            kw("CLASS"),
            kw("ENUM"),
            kw("INTERFACE"),
            kw("CONSTRUCTOR"),
            kw("DESTRUCTOR"),
            kw("CATCH"),
            kw("FINALLY")
          )
        ),
        "."
      ),

    // OPERATORS

    _logical_operator: ($) =>
      prec.left(
        choice(alias($._and_operator, "AND"), alias($._or_operator, "OR"))
      ),

    assignment_operator: ($) => choice("=", $._augmented_assignment),

    _additive_operator: ($) => choice("+", "-"),

    _multiplicative_operator: ($) => choice("*", "/", kw("MODULO"), kw("MOD")),

    _comparison_operator: ($) =>
      choice(
        "<",
        "<=",
        "<>",
        "=",
        ">",
        ">=",
        kw("LT"),
        kw("LE"),
        kw("NE"),
        kw("EQ"),
        kw("GT"),
        kw("GE"),
        kw("BEGINS"),
        kw("MATCHES"),
        kw("CONTAINS")
      ),

    // LITERALS / KEYWORDS

    _name: ($) => choice($.identifier, $.qualified_name),

    file_name: ($) => /[A-z-_|0-9|\/]+\.[ip]/i,

    comment: ($) =>
      choice(
        seq("//", /.*/),
        seq("/*", repeat(choice(/[^*]/, /\*+[^/*]/)), /\*+\//)
      ),

    annotation: ($) =>
      seq(
        "@",
        choice(
          seq(kw("TEST"), optional($.annotation_argument)),
          seq(kw("TESTSUITE"), optional($.annotation_argument)),
          kw("BEFORE"),
          kw("BEFOREALL"),
          kw("BEFOREEACH"),
          kw("SETUP"),
          kw("AFTEREACH"),
          kw("TEARDOWN"),
          kw("AFTERALL"),
          kw("AFTER"),
          kw("IGNORE")
        ),
        $._terminator
      ),

    preprocessor_directive: ($) =>
      seq(
        "&",
        token(
          choice(
            seq(
              /[^\n~]+/,
              repeat(seq("~", /\s*\n/, /[^\n~]*/))
            ),
            seq(
              kw("IF"),
              /[^\n]*/,
              repeat(seq(/\n/, /[^\n]*/)),
              /\n\s*/,
              "&", kw("ENDIF")
            )
          ),
        )
      ),

    boolean_literal: ($) =>
      choice(kw("TRUE"), kw("FALSE"), kw("YES"), kw("NO")),

    _integer_literal: ($) => /[0-9]+/,

    _decimal_literal: ($) =>
      seq($._integer_literal, alias($._namedot, "."), $._integer_literal),

    number_literal: ($) => choice($._integer_literal, $._decimal_literal),

    string_literal: ($) => seq($._escaped_string, optional(seq(":", $.string_literal_attribute))),

    string_literal_attribute: ($) =>
      choice(
        seq(kw("R"), $._integer_literal),
        seq(kw("L"), $._integer_literal),
        seq(kw("C"), $._integer_literal),
        seq(kw("T"), $._integer_literal),
        kw("U")
      ),

    date_literal: ($) => /\d{1,2}\/\d{1,2}\/\d{4}|\d{2}/,

    array_literal: ($) => seq("[", optional(choice($.range_notation, _list($._expression, ","))), "]"),

    use_widget_pool: ($) => kw("USE-WIDGET-POOL"),

    abstract: ($) => kw("ABSTRACT"),

    final: ($) => kw("FINAL"),

    workfile_tuning: ($) => kw("NO-UNDO"),

    serializable: ($) => kw("SERIALIZABLE"),

    // TODO: Should this be here???
    range_notation: ($) => seq($._expression, alias($._for_keyword, "FOR"), $._expression),

    single_quoted_string: ($) =>
      seq("'", repeat(choice(/[^'\\]+/, /\\./, $._special_character)), "'"),

    _define: ($) =>
      choice(
        kw("DEFINE"),
        alias($._def_keyword, "DEF"),
      ),

    // INCLUDES

    include_argument: ($) =>
      choice(
        seq(
          "&",
          field("name", $.identifier),
          "=",
          field("value", $._expression)
        ),
        field("name", $.identifier),
        field("value", $.string_literal),
        $.constant
      ),

    _include_arguments: ($) =>
      seq($.include_argument, repeat(seq(" ", $.include_argument))),

    include: ($) =>
      seq(
        "{",
        $.file_name,
        optional($._include_arguments),
        "}"
      ),

    // IDENTIFIERS

    identifier: ($) => /[A-Z|a-z|\-|\\_]{1}[A-Z|a-z|\-|\\_|0-9]*/i,

    constant: ($) =>
      seq("{", optional("&"), choice($.identifier, $._integer_literal), "}"),

    qualified_name: ($) =>
      seq(
        $.identifier,
        repeat1(seq(alias($._namedot, "."), choice($.identifier, "*")))
      ),

    // TUNING

    _tuning: ($) =>
      choice(
        $.access_tuning,
        $.scope_tuning,
        $.property_type
      ),

    // HACK: progress spaghetti allows to define tuning order before where clause
    _pre_tuning: ($) => prec.right(1, $.query_tuning),

    access_tuning: ($) =>
      choice(
        kw("PRIVATE"),
        kw("PROTECTED"),
        kw("PUBLIC"),
        kw("PACKAGE-PRIVATE"),
        kw("PACKAGE-PROTECTED")
      ),

    accumulate_aggregate: ($) =>
      choice(
        kw("AVERAGE"),
        kw("COUNT"),
        kw("MAXIMUM"),
        kw("MINIMUM"),
        kw("TOTAL"),
        kw("SUB-AVERAGE"),
        kw("SUB-COUNT"),
        kw("SUB-MAXIMUM"),
        kw("SUB-MINIMUM"),
        kw("SUB-TOTAL")
      ),

    argument_tuning: ($) =>
      choice(kw("BY-VALUE"), kw("BY-REFERENCE"), kw("BIND"), kw("APPEND")),

    button_tuning: ($) =>
      choice(
        seq(kw("AUTO-GO"), optional(kw("AUTO-ENDKEY"))),
        kw("DEFAULT"),
        seq(kw("BGCOLOR"), $._expression),
        seq(kw("CONTEXT-HELP-ID"), $._expression),
        seq(kw("DCOLOR"), $._expression),
        kw("DROP-TARGET"),
        seq(kw("FGCOLOR"), $._expression),
        seq(kw("FONT"), $.number_literal),
        seq(kw("IMAGE-DOWN"), $.image_phrase),
        seq(kw("IMAGE"), $.image_phrase),
        seq(kw("IMAGE-UP"), $.image_phrase),
        seq(kw("IMAGE-INSENSITIVE"), $.image_phrase),
        seq(kw("MOUSE-POINTER"), $.identifier),
        seq(kw("LABEL"), $.string_literal),
        seq(kw("LIKE"), $.identifier),
        seq(kw("PFCOLOR"), $._expression),
        seq(kw("NO-FOCUS"), optional(kw("FLAT-BUTTON"))),
        kw("NO-CONVERT-3D-COLORS"),
        seq(kw("TOOLTIP"), $.string_literal),
        $.size_phrase
      ),

    class_tuning: ($) =>
      choice(
        $.inherits,
        $.implements,
        $.use_widget_pool,
        $.abstract,
        $.final,
        $.serializable
      ),

    enum_tuning: ($) => kw("FLAGS"),

    field_option: ($) =>
      choice(
        seq(kw("BGCOLOR"), $._expression),
        seq(kw("COLUMN-LABEL"), $.string_literal),
        seq(kw("DCOLOR"), $._expression),
        seq(kw("LABEL"), $.string_literal, repeat(seq(",", $.string_literal))),
        seq(kw("FORMAT"), $.string_literal),
        seq(kw("DECIMALS"), $.number_literal),
        seq(kw("EXTENT"), $.number_literal),
        seq(kw("FONT"), $._expression),
        seq(kw("FGCOLOR"), $._expression),
        seq(kw("PFCOLOR"), $._expression),
        seq(choice(kw("INITIAL"), kw("INIT")), $._expression),
        kw("SERIALIZE-HIDDEN"),
        seq(kw("SERIALIZE-NAME"), $.string_literal),
        seq(kw("XML-DATA-TYPE"), $.string_literal),
        seq(kw("XML-NODE-TYPE"), $.string_literal),
        seq(kw("XML-NODE-NAME"), $.string_literal),
        seq(kw("HELP"), $.string_literal),
        seq(optional(kw("NOT")), kw("CASE-SENSITIVE")),
        seq(kw("MOUSE-POINTER"), $._expression),
        kw("TTCODEPAGE"),
        seq(kw("COLUMN-CODEPAGE"), $.string_literal)
      ),

    function_parameter_tuning: ($) =>
      choice(
        kw("APPEND"),
        kw("BIND"),
        kw("BY-VALUE"),
        seq(kw("EXTENT"), optional($.number_literal))
      ),

    function_parameters: ($) =>
      seq("(", optional(_list($.function_parameter, ",")), ")"),

    image_tuning: ($) =>
      choice(
        seq(kw("BGCOLOR"), $._expression),
        seq(kw("FGCOLOR"), $._expression),
        kw("CONVERT-3D-COLORS"),
        seq(kw("TOOLTIP"), $.identifier),
        seq(kw("STRETCH-TO-FIT"), optional(kw("RETAIN-SHAPE"))),
        kw("TRANSPARENT")
      ),

    index_tuning: ($) =>
      seq(
        optional(choice(kw("IS"), kw("AS"))),
        choice(
          kw("PRIMARY"),
          kw("UNIQUE"),
          kw("WORD-INDEX")
        )
      ),

    input_stream_tuning: ($) =>
      choice(
        seq(kw("LOB-DIR"), $._expression),
        kw("BINARY"),
        kw("ECHO"),
        kw("NO-ECHO"),
        choice(seq(kw("MAP"), $._expression), kw("NO-MAP")),
        kw("UNBUFFERED"),
        kw("NO-CONVERT"),
        seq(
          kw("CONVERT"),
          optional(seq(kw("TARGET"), $._expression)),
          optional(seq(kw("SOURCE"), $._expression))
        )
      ),

    interface_tuning: ($) => choice($.inherits),

    method_tuning: ($) => choice(kw("ABSTRACT"), kw("OVERRIDE"), kw("FINAL")),

    of: ($) => seq(kw("OF"), $._name),

    output_stream_tuning: ($) =>
      choice(
        seq(kw("LOB-DIR"), $._expression),
        seq(kw("NUM-COPIES"), $._expression),
        kw("COLLATE"),
        kw("BINARY"),
        choice(kw("LANDSCAPE"), kw("PORTRAIT")),
        kw("APPEND"),
        kw("ECHO"),
        kw("NO-ECHO"),
        kw("KEEP-MESSAGES"),
        choice(seq(kw("MAP"), $._expression), kw("NO-MAP")),
        kw("PAGED"),
        seq(kw("PAGE-SIZE"), $._expression),
        kw("UNBUFFERED"),
        kw("NO-CONVERT"),
        seq(
          kw("CONVERT"),
          optional(seq(kw("TARGET"), $._expression)),
          optional(seq(kw("SOURCE"), $._expression))
        )
      ),

    procedure_parameter_tuning: ($) =>
      choice(kw("APPEND"), kw("BIND"), kw("BY-VALUE")),

    property_tuning: ($) =>
      choice(
        seq(choice(kw("INITIAL"), kw("INIT")), $._expression),
        seq(kw("DECIMALS"), $._expression),
        seq(kw("EXTENT"), $.number_literal),
        kw("NO-UNDO")
      ),

    query_definition_tuning: ($) =>
      choice(
        seq(kw("CACHE"), $.number_literal),
        "SCROLLING",
        kw("RCODE-INFORMATION")
      ),

    query_tuning: ($) =>
      choice(
        kw("NO-LOCK"),
        kw("SHARE-LOCK"),
        kw("EXCLUSIVE-LOCK"),
        kw("NO-WAIT"),
        kw("NO-ERROR"),
        kw("NO-PREFETCH"),
        seq(kw("USE-INDEX"), $.identifier),
        $.using
      ),

    repeat_tuning: ($) => choice(seq(kw("WITH"), kw("FRAME"), $.identifier)),

    return_tuning: ($) => seq(kw("EXTENT"), $.number_literal),

    run_tuning: ($) =>
      choice(
        kw("PERSISTENT"),
        kw("SINGLE-RUN"),
        kw("SINGLETON"),
        kw("ASYNCHRONOUS"),
        seq(kw("SET"), $.identifier),
        seq(kw("ON"), kw("SERVER"), $.identifier),
        seq(kw("IN"), choice(kw("THIS-PROCEDURE"), $.identifier)),
        seq(kw("EVENT-PROCEDURE"), $.string_literal)
      ),

    scope_tuning: ($) =>
      choice(alias($._new_keyword, "NEW"), kw("GLOBAL"), kw("SHARED"), kw("STATIC")),

    serialization_tuning: ($) =>
      choice(kw("SERIALIZABLE"), kw("NON-SERIALIZABLE")),

    sort_order: ($) =>
      choice(kw("ASCENDING"), kw("DESCENDING"), kw("DESC"), kw("ASC")),

    temp_table_tuning: ($) =>
      choice(
        kw("NO-UNDO"),
        seq(kw("NAMESPACE-URI"), $.string_literal),
        seq(kw("NAMESPACE-PREFIX"), $.string_literal),
        seq(kw("XML-NODE-NAME"), $.string_literal),
        seq(kw("SERIALIZE-NAME"), $.string_literal),
        kw("REFERENCE-ONLY"),
        $.like_phrase,
        kw("RCODE-INFORMATION"),
        seq(kw("BEFORE-TABLE"), $.identifier),
        $.constant
      ),

    type_tuning: ($) =>
      choice(
        seq(kw("AS"), field("type", $._type)),
        seq(kw("LIKE"), field("type", $._type))
      ),

    using: ($) =>
      seq(
        kw("USING"),
        seq($.using_field, repeat(seq(kw("AND"), $.using_field)))
      ),

    variable_tuning: ($) =>
      seq(
        choice(
          seq(kw("SERIALIZE-NAME"), $.string_literal),
          seq(kw("BGCOLOR"), $._expression),
          seq(kw("FGCOLOR"), $._expression),
          seq(kw("PFCOLOR"), $._expression),
          seq(kw("DCOLOR"), $._expression),
          seq(kw("CONTEXT-HELP-ID"), $._expression),
          seq(choice(kw("INITIAL"), kw("INIT")), $._expression),
          seq(kw("FORMAT"), $._expression),
          seq(kw("FONT"), $._expression),
          seq(kw("LABEL"), $._expression),
          seq(kw("MOUSE-POINTER"), $._expression),
          seq(kw("COLUMN-LABEL"), $._expression),
          seq(kw("DECIMALS"), $.number_literal),
          seq(kw("EXTENT"), $.number_literal),
          kw("DROP-TARGET"),
          kw("NO-UNDO"),
          seq(optional(kw("NOT")), kw("CASE-SENSITIVE"))
        )
      ),

    // TYPES

    _type: ($) =>
      choice(
        $.primitive_type,
        $.identifier,
        $.qualified_name,
        $.class_type,
        $.generic_type
      ),

    primitive_type: ($) =>
      choice(
        kw("VOID"),
        kw("LOGICAL"),
        kw("INTEGER"),
        kw("INT"),
        kw("CHARACTER"),
        kw("CHAR"),
        kw("DECIMAL"),
        kw("DATE"),
        kw("DATETIME"),
        kw("DATETIME-TZ"),
        kw("INT64"),
        kw("LONGCHAR"),
        kw("MEMPTR"),
        kw("RAW"),
        kw("RECID"),
        kw("ROWID"),
        kw("HANDLE"),
        kw("COM-HANDLE")
      ),

    class_type: ($) => seq(kw("CLASS"), $._name),

    generic_type: ($) =>
      seq($._name, $.generic_expression),

    return_type: ($) =>
      seq(choice(kw("RETURNS"), kw("RETURN")), field("type", $._type)),

    property_type: ($) => choice(kw("ABSTRACT"), kw("OVERRIDE")),

    _find_type: ($) =>
      choice(kw("FIRST"), kw("LAST"), kw("NEXT"), kw("PREV"), kw("CURRENT")),

    // PARAMETERS and others

    array_access: ($) =>
      prec.right(
        1,
        seq(
          field("array", choice($.identifier, $.object_access)),
          $.array_literal,
        )
      ),

    generic_parameter: ($) => seq($.identifier, $.type_tuning),

    query_fields: ($) => seq("(", repeat($.identifier), ")"),

    argument_mode: ($) =>
      prec.right(
        choice(alias($._input_keyword, "INPUT"), alias($._output_keyword, "OUTPUT"), kw("INPUT-OUTPUT"), kw("DATA-SOURCE"))
      ),

    function_call_argument: ($) =>
      prec.right(
        1,
        seq(
          optional($.argument_mode),
          choice(
            seq(
              choice($._name, $.object_access),
              optional($.type_tuning)
            ),
            seq(
              optional(
                choice(
                  kw("TABLE"),
                  kw("TABLE-HANDLE"),
                  kw("DATASET"),
                  kw("DATASET-HANDLE")
                )
              ),
              $._expression
            )
          ),
          optional($.argument_tuning)
        )
      ),

    function_parameter: ($) =>
      choice(
        seq(
          optional(kw("TABLE-HANDLE")),
          optional($.function_parameter_mode),
          optional(
            choice(
              kw("TABLE "),
              kw("TABLE-HANDLE"),
              kw("DATASET-HANDLE"),
              kw("DATASET ")
            )
          ),
          field("name", $.identifier),
          optional($.type_tuning),
          repeat($.function_parameter_tuning)
        ),
        seq(
          kw("BUFFER"),
          field("buffer", $.identifier),
          alias($._for_keyword, "FOR"),
          field("table", $._name),
          optional(kw("PRESELECT"))
        )
      ),

    function_arguments: ($) =>
      seq(
        "(",
        optional(_list(alias($.function_call_argument, $.argument), ",")),
        ")"
      ),

    annotation_argument: ($) =>
      seq(
        "(",
        $.identifier,
        "=",
        $.string_literal,
        ")"
      ),

    inherits: ($) =>
      seq(
        kw("INHERITS"),
        _list(choice($.string_literal, $.identifier, $.qualified_name), ",")
      ),

    implements: ($) =>
      seq(
        kw("IMPLEMENTS"),
        _list(choice($.string_literal, $.identifier, $.qualified_name), ",")
      ),

    function_parameter_mode: ($) =>
      choice(alias($._input_keyword, "INPUT"), alias($._output_keyword, "OUTPUT"), kw("INPUT-OUTPUT")),

    data_relation: ($) =>
      seq(
        kw("DATA-RELATION"),
        alias($._for_keyword, "FOR"),
        _list($._name, ","),
        kw("RELATION-FIELDS"),
        seq(
          "(",
          optional(_list($._name, ",")),
          ")"
        )
      ),

    object_access: ($) =>
      seq(
        field(
          "object",
          choice($.identifier, $.new_expression, $.function_call)
        ),
        repeat1(seq(alias($._namecolon, ":"), field("property", $.identifier)))
      ),

    member_access: ($) =>
      seq(
        field("object", $.identifier),
        repeat1(
          seq(alias($._namedoublecolon, "::"), field("property", $.identifier))
        )
      ),

    _case_branch_body: ($) =>
      prec(1, choice($.do_block, field("statement", $._statement))),

    case_condition: ($) =>
      seq(optional(seq(kw("OR"), kw("WHEN"))), $._expression),

    case_when_branch: ($) =>
      seq(kw("WHEN"), repeat($.case_condition), kw("THEN"), $._case_branch_body),

    case_otherwise_branch: ($) => seq(kw("OTHERWISE"), $._case_branch_body),

    where_clause: ($) => seq(kw("WHERE"), field("condition", $._expression)),

    sort_column: ($) =>
      seq(field("column", $._expression), optional($.sort_order)),

    sort_clause: ($) =>
      seq(optional(kw("BREAK")), seq(kw("BY"), repeat1($.sort_column))),

    using_field: ($) =>
      seq(
        optional(seq(kw("FRAME"), field("frame", $.identifier))),
        field("field", $._name)
      ),

    field_clause: ($) =>
      seq(alias($._field_keyword, "FIELD"), $.identifier, $.type_tuning, repeat($.field_option)),

    index_clause: ($) =>
      seq(
        alias($._index_keyword, "INDEX"),
        $.identifier,
        repeat($.index_tuning),
        repeat(seq(field("field", $.identifier), optional($.sort_order)))
      ),

    variable: ($) => choice(field("name", $.identifier), $.assignment),

    enum_member: ($) =>
      seq(
        field("name", $.identifier),
        field(
          "value",
          optional(
            seq(
              kw("="),
              _list(
                choice($.identifier, $.number_literal, $.string_literal),
                ","
              )
            )
          )
        )
      ),

    function_call: ($) =>
      prec.right(
        1,
        seq(
          field(
            "function",
            choice($.identifier, prec.right(2, $.object_access))
          ),
          alias($.function_arguments, $.arguments),
          optional(kw("NO-ERROR"))
        )
      ),

    getter: ($) =>
      seq(
        optional($.access_tuning),
        kw("GET"),
        optional(
          seq(
            optional(alias($.function_parameters, $.parameters)),
            $.body,
            kw("END"),
            optional(kw("GET"))
          )
        ),
        $._terminator
      ),

    setter: ($) =>
      seq(
        optional($.access_tuning),
        kw("SET"),
        optional(alias($.function_parameters, $.parameters)),
        optional(seq($.body, kw("END"), optional(kw("SET")))),
        $._terminator
      ),

    on_phrase_action: ($) =>
      choice(
        seq(kw("LEAVE"), field("label", optional($.identifier))),
        seq(kw("NEXT"), field("label", optional($.identifier))),
        seq(kw("RETRY"), field("label", optional($.identifier))),
        seq(
          kw("RETURN"),
          choice(seq(kw("ERROR")), kw("NO-APPLY"), $.string_literal)
        )
      ),

    // PHRASES

    while_phrase: ($) => seq(kw("WHILE"), field("condition", $._expression)),

    to_phrase: ($) =>
      seq(
        $.assignment,
        kw("TO"),
        $._expression,
        optional(seq(kw("BY"), $.number_literal))
      ),

    combo_box_phrase: ($) =>
      seq(
        kw("COMBO-BOX"),
        repeat(
          choice(
            seq(choice(kw("LIST-ITEMS"), kw("LIST-ITEM-PAIRS")), $.string_literal, repeat(seq(",", $.string_literal))),
            seq(kw("INNER-LINES"), $.number_literal),
            $.size_phrase,
            kw("SORT"),
            seq(kw("TOOLTIP"), $.string_literal),
            kw("SIMPLE"),
            kw("DROP-DOWN"),
            kw("DROP-DOWN-LIST"),
            seq(kw("MAX-CHARS"), $.number_literal),
            seq(kw("AUTO-COMPLETION"), optional(kw("UNIQUE-MATCH")))
          )
        )
      ),

    editor_phrase: ($) =>
      seq(
        choice($.size_phrase, seq(kw("INNER-CHARS"), $.number_literal, kw("INNER-LINES"), $.number_literal)),
        repeat(
          choice(
            seq(kw("BUFFER-CHARS"), $.number_literal),
            seq(kw("BUFFER-LINES"), $.number_literal),
            kw("LARGE"),
            seq(kw("MAX-CHARS"), $.number_literal),
            kw("NO-BOX"),
            kw("NO-WORD-WRAP"),
            kw("SCROLLBAR-HORIZONTAL"),
            kw("SCROLLBAR-VERTICAL"),
            seq(kw("TOOLTIP"), $.string_literal)
          )
        )
      ),

    radio_set_phrase: ($) =>
      seq(
        kw("RADIO-SET"),
        optional(choice(seq(kw("HORIZONTAL"), optional(kw("EXPAND"))), kw("VERTICAL"))),
        seq(
          kw("RADIO-BUTTONS"),
          field("label", $.identifier), ",", field("value", $.identifier),
          repeat(seq(",", field("label", $.identifier), ",", field("value", $.identifier)))
        ),
        optional(seq(kw("TOOLTIP"), $.string_literal))
      ),

    selection_list_phrase: ($) =>
      seq(
        kw("SELECTION-LIST"),
        repeat(
          choice(
            kw("SINGLE"),
            kw("MULTIPLE"),
            kw("NO-DRAG"),
            seq(choice(kw("LIST-ITEMS"), kw("LIST-ITEM-PAIRS")), $.string_literal, repeat(seq(",", $.string_literal))),
            kw("SCROLLBAR-HORIZONTAL"),
            kw("SCROLLBAR-VERTICAL"),
            $.size_phrase,
            seq(kw("INNER-CHARS"), $.number_literal, kw("INNER-LINES"), $.number_literal),
            kw("SORT"),
            seq(kw("TOOLTIP"), $.string_literal)
          )
        ),
      ),

    slider_phrase: ($) =>
      seq(
        kw("SLIDER"),
        seq(kw("MAX-VALUE"), $.number_literal, kw("MIN-VALUE"), $.number_literal),
        repeat(
          choice(
            kw("HORIZONTAL"),
            kw("VERTICAL"),
            kw("NO-CURRENT-VALUE"),
            kw("LARGE-TO-SMALL"),
            seq(
              kw("TIC-MARKS"),
              choice(kw("NONE"), kw("TOP"), kw("BOTTOM"), kw("LEFT"), kw("RIGHT"), kw("BOTH")),
              optional(seq(kw("FREQUENCY"), $.number_literal))
            ),
            seq(kw("TOOLTIP"), $.string_literal),
            $.size_phrase
          )
        )
      ),

    view_as_phrase: ($) =>
      seq(
        kw("VIEW-AS"),
        choice(
          $.combo_box_phrase,
          $.editor_phrase,
          seq(kw("FILL-IN"), repeat(choice(kw("NATIVE"), $.size_phrase, seq(kw("TOOLTIP"), $.string_literal)))),
          $.radio_set_phrase,
          $.selection_list_phrase,
          $.slider_phrase,
          seq(kw("TEXT"), repeat(choice(kw("NATIVE"), $.size_phrase, seq(kw("TOOLTIP"), $.string_literal)))),
          seq(kw("TOGGLE-BOX"), repeat(choice(kw("NATIVE"), $.size_phrase, seq(kw("TOOLTIP"), $.string_literal)))),
        )
      ),

    on_error_phrase: ($) =>
      seq(
        kw("ON"),
        kw("ERROR"),
        kw("UNDO"),
        field("label", optional($.identifier)),
        ",",
        choice(
          $.on_phrase_action,
          kw("THROW")
        )
      ),

    on_stop_phrase: ($) =>
      seq(
        kw("ON"),
        kw("STOP"),
        kw("UNDO"),
        field("label", optional($.identifier)),
        ",",
        $.on_phrase_action
      ),

    on_quit_phrase: ($) =>
      seq(
        kw("ON"),
        kw("QUIT"),
        optional(seq(kw("UNDO"), optional($.identifier))),
        ",",
        $.on_phrase_action
      ),

    on_endkey_phrase: ($) =>
      seq(
        kw("ON"),
        kw("ENDKEY"),
        optional(seq(kw("UNDO"), optional($.identifier))),
        ",",
        $.on_phrase_action
      ),

    frame_phrase: ($) =>
      seq(
        kw("WITH"),
        repeat(
          choice(
            seq(kw("ACCUM"), optional($._expression)),
            // $.at_phrase, // TODO
            seq(kw("CANCEL-BUTTON"), $.identifier),
            kw("CENTERED"),
            // color specification
            seq(kw("COLUMN"), $._expression),
            seq($.number_literal, kw("COLUMNS")),
            kw("CONTEXT-HELP"),
            seq(kw("CONTEXT-HELP-FILE"), $.identifier),
            seq(kw("DEFAULT-BUTTON"), $.identifier),
            kw("DROP-TARGET"),
            seq(optional($._expression), kw("DOWN")),
            kw("EXPORT"),
            seq(kw("WIDGET-ID"), $.number_literal),
            seq(kw("FONT"), $._expression),
            seq(kw("FRAME"), $.identifier),
            kw("INHERIT-BGCOLOR"),
            kw("NO-INHERIT-BGCOLOR"),
            kw("INHERIT-FGCOLOR"),
            kw("NO-INHERIT-FGCOLOR"),
            kw("KEEP-TAB-ORDER"),
            kw("NO-BOX"),
            kw("NO-HIDE"),
            kw("NO-LABELS"),
            kw("USE-DICT-EXPS"),
            kw("NO-VALIDATE"),
            kw("NO-AUTO-VALIDATE"),
            kw("NO-HELP"),
            kw("NO-UNDERLINE"),
            kw("OVERLAY"),
            kw("PAGE-BOTTOM"),
            kw("PAGE-TOP"),
            seq(kw("RETAIN"), $.number_literal),
            seq(kw("ROW"), $._expression),
            kw("SCREEN-IO"),
            kw("STREAM-IO"),
            seq(kw("SCROLL"), $.number_literal),
            kw("SCROLLABLE"),
            kw("SIDE-LABELS"),
            $.size_phrase,
            seq(kw("STREAM"), field("stream", $.identifier)), // TODO: Refactor as reusable rule
            seq(kw("STREAM-HANDLE"), field("stream_handle", $.identifier)), // TODO: Refactor as reusable rule
            kw("THREE-D"),
            // title phrase
            kw("TOP-ONLY"),
            kw("USE-TEXT"),
            seq(kw("V6FRAME"), optional(choice(kw("USE-REVVIDEO"), kw("USE-UNDERLINE")))),
            seq(kw("VIEW-AS"), kw("DIALOG-BOX")),
            seq(kw("WIDTH"), $.number_literal),
            seq(kw("IN-WINDOW"), $.identifier)
          )
        )
      ),

    stop_after_phrase: ($) => seq(kw("STOP-AFTER"), $._expression),

    do_for_phrase: ($) =>
      seq(
        kw("FOR"),
        $._name,
        repeat(seq(",", $._name))
      ),

      widget_phrase: ($) =>
        choice(
          seq(kw("FRAME"), $.identifier),
          seq(optional(alias($._field_keyword, "FIELD")), $.identifier, optional(seq(kw("IN"), kw("FRAME"), $.identifier))),
          seq($.identifier, optional(seq(kw("IN"), kw("BROWSE"), $.identifier))),
          seq(choice(kw("MENU"), kw("SUB-MENU")), $.identifier),
          seq(kw("MENU-ITEM"), $.identifier, optional(seq(kw("IN"), kw("MENU"), $.identifier))),
          seq($.identifier, repeat(seq(",", $.identifier)))
        ),

      referencing_phrase: ($) =>
        seq(
          alias($._new_keyword, "NEW"), optional(kw("BUFFER")),
          $.identifier,
          alias($._old_keyword, "OLD"), optional(kw("BUFFER")),
          $.identifier,
        ),

      of_phrase: ($) =>
        seq(
          kw("OF"),
          $.widget_phrase,
        ),

      _on_statement_database_phrase: ($) =>
        prec(2, seq(
          choice(
            kw("CREATE"),
            kw("DELETE"),
            kw("FIND"),
            kw("WRITE"),
            kw("ASSIGN"),
          ),
          kw("OF"),
          $._name,
          repeat(seq(",", $._name)),
          optional($.referencing_phrase),
          optional(kw("OVERRIDE")),
          choice($.do_block, prec(2, $._statement), kw("REVERT"))
        )),

      _on_statement_widget_phrase: ($) =>
        prec(2, seq(
          _list(choice($.identifier, $.constant), ","),
          $.of_phrase,
          repeat(
            seq(
              kw("OR"),
              _list(choice($.identifier, $.constant), ","),
              $.of_phrase
            )
          ),
          optional(kw("ANYWHERE")),
          choice($.do_block, prec(2, $._statement), kw("REVERT"), seq(kw("PERSISTENT"), $.run_statement))
        )),

      image_phrase: ($) =>
        seq(
          choice(kw("IMAGE"), kw("IMAGE-UP")),
          seq(kw("FILE"), $.string_literal),
          optional(
            seq(
              choice(
                kw("IMAGE-SIZE"),
                kw("IMAGE-SIZE-CHARS"),
                kw("IMAGE-SIZE-PIXELS")
              ),
              field("width", $.number_literal),
              kw("BY"),
              field("height", $.number_literal)
            )
          ),
          optional(
            seq(
              kw("FROM"),
              choice(
                seq(kw("X"), $.number_literal, kw("Y"), $.number_literal),
                seq(kw("ROW"), $.number_literal, kw("COLUMN"), $.number_literal)
              )
            )
          )
        ),

      size_phrase: ($) =>
        seq(
          choice(kw("SIZE"), kw("SIZE-CHARS"), kw("SIZE-PIXELS")),
          field("width", $.number_literal),
          kw("BY"),
          field("height", $.number_literal)
        ),

      record_phrase: ($) =>
        seq(
          optional(field("type", choice(kw("EACH"), kw("FIRST"), kw("LAST")))),
          _list($._name, ","),
          optional($.of)
        ),

      preselect_phrase: ($) =>
        seq(
          kw("PRESELECT"),
          _list($.record_phrase, ","),
          optional($._pre_tuning),
          optional($.where_clause),
          repeat($.query_tuning),
          optional(repeat($.sort_clause))
        ),

      for_phrase: ($) =>
        seq(
          optional(field("type", choice(kw("EACH"), kw("FIRST"), kw("LAST")))),
          field("table", $._name),
          optional($.of),
          optional($._pre_tuning),
          optional($.where_clause),
          repeat($.query_tuning),
          optional(repeat($.sort_clause)),
          repeat(
            choice(
              $.on_error_phrase,
              $.on_quit_phrase,
              $.on_stop_phrase,
              $.on_endkey_phrase
            )
          )
        ),

      like_phrase: ($) =>
        seq(
          choice(kw("LIKE"), kw("LIKE-SEQUENTIAL")),
          $.identifier,
          optional(kw("VALIDATE")),
          optional(seq(kw("USE-INDEX"), $.identifier, optional(seq(kw("AS"), kw("PRIMARY")))))
        ),


    // DEFINITIONS

    definition: ($) =>
      seq(
        $._define,
        repeat($._tuning),
        choice(
          $.variable_definition,
          $.buffer_definition,
          $.query_definition,
          $.temp_table_definition,
          $.workfile_definition,
          $.property_definition,
          $.data_source_definition,
          $.event_definition,
          $.dataset_definition,
          $.stream_definition,
          $.image_definition
        )
      ),

    buffer_definition: ($) =>
      seq(
        kw("BUFFER"),
        field("name", $.identifier),
        alias($._for_keyword, "FOR"),
        optional(kw("TEMP-TABLE")),
        field("table", $._name),
        $._terminator
      ),

    button_definition: ($) =>
      seq(
        kw("BUTTON"),
        field("name", $.identifier),
        repeat($.button_tuning),
      ),

       // button_definition: ($) =>
    //   seq(
    //     $._define,
    //     optional($.access_tuning),
    //     kw("BUTTON"),
    //     field("name", $.identifier),
    //     repeat($.button_tuning),
    //     $._terminator
    //   ),

    dataset_definition: ($) =>
      seq(
        kw("DATASET"),
        field("name", $.identifier),
        alias($._for_keyword, "FOR"),
        _list($._name, ","),
        optional($.data_relation),
        $._terminator
      ),

    data_source_definition: ($) =>
      seq(
        kw("DATA-SOURCE"),
        $.identifier,
        alias($._for_keyword, "FOR"),
        optional(seq(kw("QUERY"), $.identifier)),
        optional(
          _list($._name, ",")),
        $._terminator
      ),

    enum_definition: ($) =>
      seq(
        $._define,
        kw("ENUM"),
        repeat($.enum_member),
        $._terminator
      ),

    event_definition: ($) =>
      seq(
        kw("EVENT"),
        $.identifier,
        optional(kw("SIGNATURE")),
        kw("VOID"),
        alias($.function_parameters, $.parameters),
        $._terminator
      ),

      // frame_definition: ($) =>
    //   seq(
    //     kw("FRAME"),
    //     field("name", $.identifier),

    //     seq(optional(choice(kw("HEADER"), kw("BACKGROUND")))), // head item
    //     optional($.frame_phrase)


    //     // form item
    //   ),

    image_definition: ($) =>
      seq(
        kw("IMAGE"),
        field("name", $.identifier),
        choice($.size_phrase, $.image_phrase, seq(kw("LIKE"), $.identifier)),
        repeat($.image_tuning),
        $._terminator
      ),

    procedure_parameter_definition: ($) =>
      seq(
        $._define,
        optional(
          choice(alias($._input_keyword, "INPUT"), alias($._output_keyword, "OUTPUT"), kw("INPUT-OUTPUT"), kw("RETURN"))
        ),
        choice(kw("PARAMETER"), kw("PARAM")),
        optional(
          choice(
            seq(kw("BUFFER"), field("buffer", $.identifier)),
            choice(
              kw("TABLE"),
              kw("TABLE-HANDLE"),
              seq(kw("DATASET"), optional(token.immediate(kw("-HANDLE"))))
            )
          )
        ),
        optional(alias($._for_keyword, "FOR")),
        field("name", $.identifier),
        choice(
          seq($.type_tuning, repeat($.variable_tuning)),
          repeat($.procedure_parameter_tuning)
        ),
        $._terminator
      ),

    property_definition: ($) =>
      seq(
        kw("PROPERTY"),
        field("name", $.identifier),
        $.type_tuning,
        repeat($.property_tuning),
        choice(repeat1(choice($.getter, $.setter)), $._terminator)
      ),

    query_definition: ($) =>
      seq(
        kw("QUERY"),
        field("name", $.identifier),
        alias($._for_keyword, "FOR"),
        $.identifier,
        optional(seq(kw("FIELDS"), $.query_fields)),
        optional(seq(kw("EXCEPT"), $.query_fields)),
        repeat($.query_definition_tuning),
        $._terminator
      ),

    stream_definition: ($) =>
      seq(
        kw("STREAM"),
        field("name", $.identifier),
        $._terminator
      ),

    temp_table_definition: ($) =>
      seq(
        repeat(choice($.serialization_tuning, $.constant)),
        kw("TEMP-TABLE"),
        choice($.identifier, $.constant),
        repeat($.temp_table_tuning),
        repeat(choice($.field_clause, $.index_clause, $.include)),
        $._terminator
      ),

    variable_definition: ($) =>
      seq(
        choice(kw("VARIABLE"), kw("VAR")),
        field("name", $.identifier),
        $.type_tuning,
        repeat(
          choice(
            $.variable_tuning,
            $.view_as_phrase
          )),
        $._terminator
      ),

    workfile_definition: ($) =>
      seq(
        choice(kw("WORKFILE"), kw("WORK-TABLE")),
        field("name", $.identifier),
        repeat($.workfile_tuning),
        optional($.type_tuning),
        repeat($.field_clause),
        $._terminator
      ),

    // STATEMENTS

    null_statement: ($) => seq(choice($.object_access), $._terminator),

    using_statement: ($) =>
      seq(
        kw("USING"),
        $._name,
        optional(seq(kw("FROM"), choice(kw("ASSEMBLY"), kw("PROPATH")))),
        $._terminator
      ),

    interface_statement: ($) =>
      seq(
        kw("INTERFACE"),
        field("name", choice($.string_literal, $.identifier, $.qualified_name)),
        repeat($.interface_tuning),
        alias($.interface_body, $.body),
        $._block_terminator
      ),

    class_statement: ($) =>
      seq(
        kw("CLASS"),
        field("name", choice($.string_literal, $.identifier, $.qualified_name)),
        repeat($.class_tuning),
        alias($.class_body, $.body),
        $._block_terminator
      ),

    constructor_statement: ($) =>
      seq(
        kw("CONSTRUCTOR"),
        repeat(choice($.scope_tuning, $.access_tuning)),
        $.identifier,
        alias($.function_parameters, $.parameters),
        $.body,
        $._block_terminator
      ),

    destructor_statement: ($) =>
      seq(
        kw("DESTRUCTOR"),
        repeat($.access_tuning),
        $.identifier,
        seq("(", ")"),
        $.body,
        $._block_terminator
      ),

    method_statement: ($) =>
      seq(
        kw("METHOD"),
        repeat(choice($.access_tuning, $.scope_tuning, $.method_tuning)),
        alias($._type, $.return_type),
        optional($.return_tuning),
        field("name", $.identifier),
        alias($.function_parameters, $.parameters),
        optional(seq($.body, kw("END"), optional(kw("METHOD")))),
        $._terminator
      ),

    procedure_statement: ($) =>
      seq(
        kw("PROCEDURE"),
        $.identifier,
        optional(kw("PRIVATE")),
        optional(alias($.dot_body, $.body)),
        $._block_terminator
      ),

    case_statement: ($) =>
      seq(
        kw("CASE"),
        $._expression,
        alias($.case_body, $.body),
        $._block_terminator
      ),

    variable_assignment: ($) => seq($.assignment, $._terminator),

    assignment: ($) =>
      prec.right(
        PREC.ASSIGN,
        seq(
          prec.left(
            field(
              "name",
              choice(
                $.identifier,
                $.qualified_name,
                $.object_access,
                $.member_access,
                $.function_call,
                $.array_access
              )
            )
          ),
          $.assignment_operator,
          prec.right(choice($._expression, $.include)),
          optional($.when_expression)
        )
      ),

    function_call_statement: ($) => seq($.function_call, $._terminator),

    function_statement: ($) =>
      seq(
        kw("FUNCTION"),
        field("name", $.identifier),
        $.return_type,
        optional($.return_tuning),
        optional(alias($.function_parameters, $.parameters)),
        optional(alias($.dot_body, $.body)),
        $._block_terminator
      ),

    repeat_statement: ($) =>
      seq(
        optional($.label),
        kw("REPEAT"),
        optional($.preselect_phrase),
        optional($.to_phrase),
        optional($.while_phrase),
        repeat(
          choice(
            $.on_error_phrase,
            $.on_quit_phrase,
            $.on_stop_phrase,
            $.on_endkey_phrase
          )
        ),
        repeat($.repeat_tuning),
        $.body,
        $._block_terminator
      ),

    return_statement: ($) =>
      seq(kw("RETURN"), optional($._expression), $._terminator),

    _stream_statement: ($) =>
      choice($.input_stream_statement, $.output_stream_statement),

    input_stream_statement: ($) =>
      seq(
        alias($._input_keyword, "INPUT"),
        optional(
          seq(
            choice(kw("STREAM"), kw("STREAM-HANDLE")),
            field("source", $.identifier)
          )
        ),
        kw("FROM"),
        field("target", $._expression),
        repeat($.input_stream_tuning),
        $._terminator
      ),

    output_stream_statement: ($) =>
      seq(
        alias($._output_keyword, "OUTPUT"),
        optional(
          seq(
            choice(kw("STREAM"), kw("STREAM-HANDLE")),
            field("source", $.identifier)
          )
        ),
        kw("TO"),
        field("target", $._expression),
        repeat($.output_stream_tuning),
        $._terminator
      ),

    input_close_statement: ($) =>
      seq(
        alias($._input_keyword, "INPUT"),
        optional(
          choice(
            seq(kw("STREAM"), field("stream", $.identifier)),
            seq(kw("STREAM-HANDLE"), field("stream_handle", $.identifier))
          )
        ),
        kw("CLOSE"),
        $._terminator
      ),

    output_close_statement: ($) =>
      seq(
        alias($._output_keyword, "OUTPUT"),
        optional(
          choice(
            seq(kw("STREAM"), field("stream", $.identifier)),
            seq(kw("STREAM-HANDLE"), field("stream_handle", $.identifier))
          )
        ),
        kw("CLOSE"),
        $._terminator
      ),

    for_statement: ($) =>
      seq(
        optional($.label),
        alias($._for_keyword, "FOR"),
        field("type", choice(kw("EACH"), kw("FIRST"), kw("LAST"))),
        field("table", $._name),
        optional($.of),
        optional($._pre_tuning),
        optional($.where_clause),
        repeat($.query_tuning),
        repeat($.sort_clause),
        repeat(
          choice(
            $.on_error_phrase,
            $.on_quit_phrase,
            $.on_stop_phrase,
            $.on_endkey_phrase
          )
        ),
        repeat(seq(",", $.for_phrase)),
        optional($.frame_phrase),
        $.body,
        $._block_terminator
      ),

    find_statement: ($) =>
      seq(
        kw("FIND"),
        field("type", optional($._find_type)),
        field("table", $._name),
        optional($.of),
        optional($._pre_tuning),
        optional($.where_clause),
        repeat($.query_tuning),
        $._terminator
      ),

    abl_statement: ($) =>
      seq(
        field("statement", $.identifier),
        repeat(prec(-1, $._expression)),
        $._terminator
      ),

    assign_statement: ($) =>
      seq(
        kw("ASSIGN"),
        repeat($.assignment), // no need for choice
        optional(kw("NO-ERROR")),
        $._terminator
      ),

    catch_statement: ($) =>
      seq(
        kw("CATCH"),
        field("variable", $.identifier),
        kw("AS"),
        field(
          "type",
          seq(optional(kw("CLASS")), $._name)
        ),
        $.body,
        $._block_terminator
      ),

    finally_statement: ($) =>
      seq(
        kw("FINALLY"),
        $.body,
        $._block_terminator
      ),

    accumulate_statement: ($) =>
      seq(
        kw("ACCUMULATE"),
        choice($._expression, $.identifier),
        seq(
          "(",
          seq($.accumulate_aggregate, repeat(seq(" ", $.accumulate_aggregate))),
          ")"
        ),
        $._terminator
      ),

    undo_statement: ($) =>
      seq(
        kw("UNDO"),
        field("label", optional($.identifier)),
        ",",
        choice(
          seq(kw("LEAVE"), field("label", optional($.identifier))),
          seq(kw("NEXT"), field("label", optional($.identifier))),
          seq(kw("RETRY"), field("label", optional($.identifier))),
          seq(kw("RETURN"), choice(seq(kw("ERROR")), kw("NO-APPLY"))),
          seq(kw("THROW"), $._expression)
        ),
        $._terminator
      ),

    error_scope_statement: ($) =>
      seq(
        choice(kw("ROUTINE-LEVEL"), kw("BLOCK-LEVEL")),
        $.on_error_phrase,
        $._terminator
      ),

    on_statement: ($) =>
      seq(
        kw("ON"),
        choice(
          $._on_statement_widget_phrase,
          $._on_statement_database_phrase,
          seq(field("label", $.identifier), field("function", $.identifier), $._terminator),
          seq(alias("\"WEB-NOTIFY\"", $.string_literal), kw("ANYWHERE"), choice($.do_block, prec(2, $._statement)))
        )
      ),

    prompt_for_statement: ($) =>
      seq(
        kw("PROMPT-FOR"),
        $._name,
        optional(seq(kw("FRAME"), field("frame", $.identifier))),
        choice(seq(kw("EDITING"), $.body, $._block_terminator), $._terminator)
      ),

    var_statement: ($) =>
      seq(
        alias($._var_keyword, "VAR"),
        optional(
          choice($.scope_tuning, $.access_tuning, $.serialization_tuning)
        ),
        alias(choice($._type, $.string_literal), $.type_tuning),
        optional(field("size", $.array_literal)),
        repeat(seq($.variable, optional(","))),
        $._terminator
      ),

    run_statement: ($) =>
      seq(
        kw("RUN"),
        field(
          "procedure",
          choice($._name, $.function_call, $.file_name)
        ),
        repeat($.run_tuning),
        optional(alias($.function_arguments, $.arguments)),
        optional(kw("NO-ERROR")),
        $._terminator
      ),

    enum_statement: ($) =>
      seq(
        kw("ENUM"),
        field("name", $.identifier),
        optional(kw("FLAGS")),
        alias($.enum_body, $.body),
        $._block_terminator
      ),

    do_block: ($) =>
      seq(
        optional($.label),
        kw("DO"),
        repeat(
          choice(
            $.do_for_phrase,
            $.preselect_phrase,
            $.to_phrase,
            $.while_phrase,
            $.stop_after_phrase,
            kw("TRANSACTION")
          )
        ),
        repeat(
          choice(
            $.on_error_phrase,
            $.on_quit_phrase,
            $.on_stop_phrase,
            $.on_endkey_phrase
          )
        ),
        alias($.dot_body, $.body),
        $._block_terminator
      ),

    if_statement: ($) =>
      seq(
        kw("IF"),
        field("condition", $._expression),
        kw("THEN"),
        choice($.do_block, prec(2, $._statement)),
        repeat(choice($.else_statement))
      ),

    else_statement: ($) =>
      prec(
        1,
        seq(
          kw("ELSE"),
          optional(
            seq(kw("IF"), field("condition", $._expression), kw("THEN"))
          ),
          choice($.do_block, $._statement)
        )
      ),

    // EXPRESSIONS

    null_expression: ($) => /\?/,

    parenthesized_expression: ($) => seq("(", $._expression, ")"),

    generic_expression: ($) =>
      seq(
        "<",
        _list(choice($._name, $.generic_parameter), ","),
        ">"
      ),

    logical_expression: ($) =>
      prec.right(
        PREC.LOGICAL,
        seq($._expression, $._logical_operator, $._expression)
      ),

    _unary_minus_expressions: ($) =>
      choice(
        $.identifier,
        $.number_literal,
        $.function_call,
        $.qualified_name,
        $.object_access,
        $.member_access,
        $.parenthesized_expression
      ),

    unary_expression: ($) =>
      choice(
        prec.left(
          PREC.UNARY,
          seq(kw("-"), prec.left($._unary_minus_expressions))
        ),
        prec.left(
          PREC.LOGICAL,
          seq(kw("NOT"), prec.left(PREC.LOGICAL, $._expression))
        )
      ),

    ambiguous_expression: ($) => seq(kw("AMBIGUOUS"), $._expression),

    temp_table_expression: ($) =>
      seq(kw("TEMP-TABLE"), field("table", choice($._expression))),

    current_changed_expression: ($) =>
      seq(kw("CURRENT-CHANGED"), $._expression),

    locked_expression: ($) => seq(kw("LOCKED"), $._expression),

    dataset_expression: ($) => seq(prec.left(kw("DATASET")), $._expression),

    when_expression: ($) => seq(kw("WHEN"), $._expression),


    input_expression: ($) =>
      seq(
        alias($._input_keyword, "INPUT"),
        optional(seq(kw("FRAME"), field("frame", $.identifier))),
        field("field", $._name)
      ),

    additive_expression: ($) =>
      prec.left(
        PREC.ADD,
        choice(seq($._expression, $._additive_operator, $._expression))
      ),

    multiplicative_expression: ($) =>
      prec.left(
        PREC.MULTI,
        choice(seq($._expression, $._multiplicative_operator, $._expression))
      ),


    comparison_expression: ($) =>
      prec.right(
        PREC.COMPARE,
        seq($._expression, $._comparison_operator, $._expression)
      ),

    _binary_expression: ($) =>
      choice(
        $.additive_expression,
        $.multiplicative_expression,
        $.comparison_expression,
        $.logical_expression
      ),

    can_find_expression: ($) =>
      seq(
        kw("CAN-FIND"),
        "(",
        optional(choice(kw("FIRST"), kw("LAST"))),
        field("table", $._name),
        optional(field("constant", $._expression)),
        repeat(choice($.query_tuning, $.of, $.where_clause)),
        ")"
      ),

    accumulate_expression: ($) =>
      seq(kw("ACCUM"), $.accumulate_aggregate, prec.left($._expression)),

    available_expression: ($) =>
      seq(
        choice(kw("AVAIL"), kw("AVAILABLE")),
        choice($.parenthesized_expression, $.identifier)
      ),

    new_expression: ($) =>
      prec.right(
        seq(
          choice(alias($._new_keyword, "NEW"), kw("DYNAMIC-NEW")),
          $._name,
          alias($.function_arguments, $.arguments),
          optional(kw("NO-ERROR"))
        )
      ),

    ternary_expression: ($) =>
      prec.right(
        seq(
          kw("IF"),
          field("condition", $._expression),
          kw("THEN"),
          field("then", $._expression),
          kw("ELSE"),
          field("else", $._expression)
        )
      ),

    // SUPERTYPES

    _expression: ($) =>
      choice(
        $.parenthesized_expression,
        $.unary_expression,
        $.null_expression,
        $._binary_expression,
        $.ternary_expression,
        $.available_expression,
        $.accumulate_expression,
        $.ambiguous_expression,
        $.temp_table_expression,
        $.current_changed_expression,
        $.locked_expression,
        $.dataset_expression,
        $.input_expression,
        $.can_find_expression,
        $.new_expression,

        $.boolean_literal,
        $.string_literal,
        $.date_literal,
        $.number_literal,
        $.array_literal,

        $.object_access,
        $.member_access,
        $.array_access,
        $.function_call,

        $._name,
        $.constant
      ),

    _statement: ($) =>
      choice(
        $.var_statement,
        $.null_statement,
        $.procedure_statement,
        $.function_statement,
        $.function_call_statement,
        $.return_statement,
        $.if_statement,
        $.for_statement,
        $.repeat_statement,
        $.find_statement,
        $._stream_statement,
        $.case_statement,
        $.input_close_statement,
        $.output_close_statement,
        $.assign_statement,
        $.catch_statement,
        $.finally_statement,
        $.accumulate_statement,
        $.undo_statement,
        $.error_scope_statement,
        $.using_statement,
        $.class_statement,
        $.interface_statement,
        $.on_statement,
        $.prompt_for_statement,
        $.run_statement,
        $.enum_statement,
        $.abl_statement,

        $.definition,
        $.procedure_parameter_definition,

        $.variable_assignment,
        $.do_block,
        $.preprocessor_directive,
        $.include,
        $.annotation
      )
  }
});

function _list(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)));
}

function kw(keyword) {
  if (keyword.toUpperCase() != keyword) {
    throw new Error(`Expected upper case keyword got ${keyword}`);
  }

  return alias(reserved(createCaseInsensitiveRegex(keyword)), keyword);
}

function reserved(regex) {
  return token(prec(1, new RegExp(regex)));
}

function createCaseInsensitiveRegex(word) {
  return new RegExp(
    word
      .split("")
      .map((letter) => `[${letter.toLowerCase()}${letter.toUpperCase()}]`)
      .join("")
  );
}

function combinations(arr) {
  let result = [];

  // Helper function to generate combinations
  function generateCombination(start, combination) {
    for (let i = start; i < arr.length; i++) {
      combination.push(arr[i]);
      result.push([...combination]);
      generateCombination(i + 1, combination);
      combination.pop();
    }
  }

  generateCombination(0, []);
  return result;
}
