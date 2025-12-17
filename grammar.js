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
    $._return_keyword
  ],
  extras: ($) => [$.comment, /[\s\f\uFEFF\u2060\u200B]|\\\r?\n/],
  word: ($) => $.identifier,
  supertypes: ($) => [$._expression, $._statement],
  conflicts: ($) => [
    [$.sort_clause],
    [$.string_literal],
    [$.if_statement],
    [$._name, $.radio_set_phrase],
    [$.radio_set_phrase, $._expression],
    [$._list_items, $._expression],
    [$.size_phrase, $.frame_definition],
    [$.dataset_expression, $.object_access],
    [$.in_frame_phrase, $._expression],
    [$.in_frame_phrase, $._message_statement_expression],
    [$.include, $.constant],
    [$.include_argument],
    [$.include_argument, $._constant_value],
    [$._literal, $._expression],
  ],

  rules: {
    source_code: ($) => repeat(choice($._statement, $.class_statement, $._definition, $.do_block, $.interface_statement, $.method_statement, $.constant)),

    
    body: ($) => seq(":", repeat(choice($._statement, $._definition, $.do_block, prec(-1, $.annotation)))),

    _statement_body: ($) => choice($.do_block, prec(2, $._statement), $.constant),

    dot_body: ($) => seq(choice(":", "."), repeat(choice($._statement, $._definition))),

    class_body: ($) =>
      seq(
        ":",
        repeat(
          choice(
            $._definition,
            $.var_statement,
            $.include,
            seq(
              optional($.annotation),
              $.method_statement
            ),
            $.constructor_statement,
            $.destructor_statement,
            $.function_statement
          )
        )
      ),

    interface_body: ($) =>
      seq(
        ":",
        repeat(
          choice(
            $._definition,
            $.annotation,
            $.method_statement
          )
        ),
      ),

    case_body: ($) =>
      seq(":", repeat1(prec.right(seq(optional($.annotation), $.case_when_branch, optional($.annotation)))), optional(seq(optional($.annotation), $.case_otherwise_branch, optional($.annotation)))),

    enum_body: ($) => seq(":", repeat1($.enum_definition)),

    label: ($) => seq($.identifier, ":"),

    _terminator: ($) => /\s*\./,

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

    file_name: ($) => /[A-z-_|0-9|\/]+\.[ipwr]/i,

    // TODO: FIX
    comment: ($) =>
      choice(seq("//", /[^\r\n]*/), seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),
    // Note: This was initial solution for comments inside comments. Does not work
    //  choice(
    //     seq("//", /.*/),
    //     seq("/*", repeat(choice(/[^*]/, /\*+[^/*]/)), /\*+\//)
    //   ),

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
          kw("IGNORE"),
          //These are extra annotations that we added for the OpenEdge ABL Formatter.
          //For more details, please visit: https://marketplace.visualstudio.com/items?itemName=BalticAmadeus.openedge-abl-formatter
          kw("ABLFORMATTEREXCLUDESTART"),
          kw("ABLFORMATTEREXCLUDEEND"),
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

    _literal: ($) =>
      choice(
        $.number_literal,
        $.string_literal,
        $.date_literal
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
        seq(
          choice(
            kw("R"),
            kw("L"),
            kw("C"),
            kw("T")
          ),
          $._integer_literal
        ),
        kw("U")
      ),

    date_literal: ($) => /\d{1,2}\/\d{1,2}\/\d{4}|\d{2}/,

    array_literal: ($) =>
      seq(
        "[",
        optional($._array_literal_body),
        "]"
      ),

    _array_literal_body: ($) =>
      choice(
        $.range_notation,
        _list($._array_literal_member, ",")
      ),

    _array_literal_member: ($) =>
      choice(
        $.new_expression,
        $.number_literal,
        $.string_literal,
        $.boolean_literal,
        $.null_expression,
        $.function_call,
        $.array_literal,
        $.array_access,
        $.identifier,
        $.constant,
        $._binary_expression
      ),

    range_notation: ($) =>
      seq(
        choice($.identifier, $._integer_literal),
        alias($._for_keyword, "FOR"),
        $._integer_literal
      ),

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
          field("value", $.string_literal)
        ),
        field("name", $.identifier),
        field("value", $.string_literal),
        $.constant,
        $.identifier
      ),

    include: ($) =>
      prec.right(1, seq(
        "{",
        choice(
          $.file_name,
          prec(1, alias($.include_file_path, $.file_name)),
          $.identifier
        ),
        repeat($.include_argument),
        "}",
        optional(".")
      )),

    include_file_path: ($) =>
      prec.right(repeat1(choice(
        $.constant, 
        /[A-z-_|0-9|\/\.]+/i
      ))),

    // IDENTIFIERS

    identifier: ($) => /[A-Z|a-z|\-|\\_]{1}[#+&A-Z|a-z|\-|\\_|0-9]*/i,

    // variable_name: ($) => choice(
    //   $.identifier,
    //   seq($.identifier, "&")
    // ),

    constant: ($) =>
      seq("{", optional("&"), $._constant_value, "}"),

    _constant_value: ($) => choice(
      $.identifier, 
      $._integer_literal,
      seq($.identifier, "=", choice($.identifier, $._integer_literal, $.string_literal)),
      seq($.identifier, repeat1(choice(/[\s\-()a-zA-Z0-9]+/)))
    ),

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
        $.member_modifier,
        $.constant
      ),

    // TODO: Fix! HACK: progress spaghetti allows to define tuning order before where clause
    // Leaving this here, just in case if it has to be reverted
    // _pre_tuning: ($) => prec.right(1, $.query_tuning),

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

    _message_tuning: ($) =>
      choice(
        $.message_color,
        $._message_alert_box,
        $.message_update,
        $.message_pause,
        kw("NO-ERROR")
    ),

    message_color: ($) =>
      seq(
        kw("COLOR"),
        $.color_phrase
      ),

    color_phrase: ($) =>
      choice(
        kw("NORMAL"),
        kw("INPUT"),
        kw("MESSAGES"),
        seq(
          optional(
            choice(
              kw("BLINK-"),
              kw("RVV-"),
              kw("UNDERLINE-"),
              kw("BRIGHT-")
            )
          ),
          choice($.string_literal, $.identifier)
        ),

        seq(
          kw("VALUE"),
          "(", $._expression, 
          ")")
      ),
    
    _message_alert_box: ($) =>
      seq(
        kw("VIEW-AS"),
        kw("ALERT-BOX"),
        optional($.alert_box_type),
        optional($.alert_box_buttons),
        optional(seq(kw("TITLE"), choice($.string_literal, $.additive_expression)))
      ),

    alert_box_type: ($) =>
      choice(
        kw("MESSAGE"),
        kw("INFORMATION"),
        kw("INFO"),
        kw("WARNING"),
        kw("ERROR"),
        kw("QUESTION")
      ),

    alert_box_buttons: ($) =>
      seq(
        kw("BUTTONS"),
        choice(
          kw("OK"),
          kw("CANCEL"),
          kw("OK-CANCEL"),
          kw("YES-NO"),
          kw("YES-NO-CANCEL"),
          kw("OK-HELP"),
          kw("YES-NO-HELP"),
          $.identifier,
          $.string_literal
        )
      ),

    message_update: ($) =>
      seq(
        choice(
          kw("UPDATE"),
          kw("SET")
        ),
        $._name,
        repeat(
          choice(
            seq(
              choice(
                kw("AS"),
                kw("LIKE")),
                $._type
              ),
              seq(
                kw("FORMAT"),
                $.string_literal
              ),
              kw("AUTO-RETURN")
          )
        ),
      ),

    message_pause:($) => kw("PAUSE"),
    

    // button_tuning: ($) =>
    //   choice(
    //     seq(kw("AUTO-GO"), optional(kw("AUTO-ENDKEY"))),
    //     kw("DEFAULT"),
    //     $._bgcolor,
    //     $._context_help_id,
    //     $._dcolor,
    //     kw("DROP-TARGET"),
    //     $._fgcolor,
    //     $._font,
    //     $.image_phrase,
    //     seq(kw("MOUSE-POINTER"), $.identifier),
    //     $._label,
    //     seq(kw("LIKE"), $.identifier),
    //     $._pfcolor,
    //     seq(kw("NO-FOCUS"), optional(kw("FLAT-BUTTON"))),
    //     kw("NO-CONVERT-3D-COLORS"),
    //     $._tooltip,
    //     $.size_phrase
    //   ),

    class_tuning: ($) =>
      choice(
        $.inherits,
        $.implements,
        kw("USE-WIDGET-POOL"),
        kw("ABSTRACT"),
        kw("FINAL"),
        kw("SERIALIZABLE")
      ),

    field_option: ($) =>
      choice(
        $._column_label,
        // $._dcolor,
        $._label,
        $._format,
        $._value_tuning,
        $._font,
        // $._fgcolor,
        // $._pfcolor,
        kw("SERIALIZE-HIDDEN"),
        $._serialize_name,
        // seq(kw("XML-DATA-TYPE"), $.string_literal),
        // seq(kw("XML-NODE-TYPE"), $.string_literal),
        // seq(kw("XML-NODE-NAME"), $.string_literal),
        seq(kw("HELP"), $.string_literal),
        seq(optional(kw("NOT")), kw("CASE-SENSITIVE")),
        seq(kw("MOUSE-POINTER"), $.identifier),
        // kw("TTCODEPAGE"),
        // seq(kw("COLUMN-CODEPAGE"), $.string_literal)
      ),

    parameter_tuning: ($) =>
      choice(
        kw("APPEND"),
        kw("BIND"),
        kw("BY-VALUE"),
        kw("BY-REFERENCE"),
        $._extent
      ),

    function_parameters: ($) =>
      seq("(", optional(_list($.function_parameter, ",")), ")"),

    // image_tuning: ($) =>
    //   choice(
    //     $._bgcolor,
    //     $._fgcolor,
    //     kw("CONVERT-3D-COLORS"),
    //     $._tooltip,
    //     seq(kw("STRETCH-TO-FIT"), optional(kw("RETAIN-SHAPE"))),
    //     kw("TRANSPARENT")
    //   ),

    index_tuning: ($) =>
      seq(
        optional(choice(kw("IS"), kw("AS"))),
        choice(
          kw("PRIMARY"),
          kw("UNIQUE"),
          kw("WORD-INDEX")
        )
      ),

    of: ($) => seq(kw("OF"), $._name),

    stream_tuning: ($) =>
      choice(
        // seq(kw("LOB-DIR"), $.string_literal),
        seq(kw("NUM-COPIES"), $._integer_literal),
        seq(kw("MAP"), $.identifier),
        seq(
          kw("CONVERT"),
          optional(seq(kw("TARGET"), choice($.identifier, $.string_literal))),
          optional(seq(kw("SOURCE"), choice($.identifier, $.string_literal)))
        ),
      ),

    stream_flag: ($) =>
      choice(
        kw("COLLATE"),
        kw("BINARY"),
        kw("LANDSCAPE"),
        kw("PORTRAIT"),
        kw("APPEND"),
        kw("ECHO"),
        kw("NO-ECHO"),
        kw("KEEP-MESSAGES"),
        kw("NO-MAP"),
        kw("PAGED"),
        kw("UNBUFFERED"),
        kw("NO-CONVERT")
      ),

    _value_tuning: ($) =>
      choice(
        $._initial,
        seq(kw("DECIMALS"), $.number_literal),
        $._extent,
        kw("NO-UNDO")
      ),

    query_definition_tuning: ($) =>
      choice(
        seq(kw("FIELDS"), $.query_fields),
        seq(kw("EXCEPT"), $.query_fields),
        seq(kw("CACHE"), $.number_literal),
        kw("SCROLLING"),
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

    workfile_tuning: ($) =>
      choice(
        $.type_tuning,
        $.field_clause
      ),

    repeat_tuning: ($) => seq(kw("WITH"), $._frame),

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
        // seq(kw("NAMESPACE-URI"), $.string_literal),
        // seq(kw("NAMESPACE-PREFIX"), $.string_literal),
        // seq(kw("XML-NODE-NAME"), $.string_literal),
        $._serialize_name,
        kw("REFERENCE-ONLY"),
        $.like_phrase,
        kw("RCODE-INFORMATION"),
        seq(kw("BEFORE-TABLE"), $.identifier),
        $.constant
      ),

    type_tuning: ($) =>
      choice(
        seq(kw("AS"), field("type", choice($._type, $.string_literal))),
        seq(kw("LIKE"), field("type", choice($._type, $.string_literal)))
      ),

    using: ($) =>
      seq(
        kw("USING"),
        seq($.using_field, repeat(seq(kw("AND"), $.using_field)))
      ),

    variable_tuning: ($) =>
      choice(
        $._serialize_name,
        // $._bgcolor,
        // $._fgcolor,
        // $._pfcolor,
        // $._dcolor,
        // $._context_help_id,
        $._value_tuning,
        $._format,
        $._font,
        $._label,
        seq(kw("MOUSE-POINTER"), $.identifier),
        $._column_label,
        // kw("DROP-TARGET"),
        seq(optional(kw("NOT")), kw("CASE-SENSITIVE")),
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
      seq(choice(kw("RETURNS"), alias($._return_keyword, "RETURN")), field("type", $._type)),

    member_modifier: ($) => choice(kw("ABSTRACT"), kw("OVERRIDE"), kw("FINAL")),

    _find_type: ($) =>
      choice(kw("FIRST"), kw("LAST"), kw("NEXT"), kw("PREV"), kw("CURRENT")),

    // PARAMETERS and others

    array_access: ($) =>
      prec.right(
        1,
        seq(
          field("array", choice($.identifier, $.qualified_name, $.object_access)),
          $.array_literal,
        )
      ),

    generic_parameter: ($) => seq($.identifier, $.type_tuning),

    query_fields: ($) => seq("(", repeat1($.identifier), ")"),

    argument_mode: ($) =>
      prec.right(
        choice(
          alias($._input_keyword, "INPUT"),
          alias($._output_keyword, "OUTPUT"),
          kw("INPUT-OUTPUT"),
          kw("DATA-SOURCE"))
      ),

      // TODO: Refactor
    function_call_argument: ($) =>
      prec.right(
        1,
        seq(
          optional($.argument_mode),
          choice(
            $.ternary_expression,
            seq(
              choice($._name, $.object_access, $.member_access),
              optional($.type_tuning)
            ),
            seq(
              optional(
                choice(
                  seq(kw("TABLE"), optional(token.immediate(kw("-HANDLE")))),
                  seq(kw("DATASET"), optional(token.immediate(kw("-HANDLE"))))
                )
              ),
              $._name
            ),
            $.input_expression,
            $.array_access,
            $.string_literal,
            $.number_literal,
            $.null_expression,
            $.constant,
            $._binary_expression,
            $.unary_expression,
            $.function_call,
            $.boolean_literal
          ),
          repeat($.parameter_tuning)
        )
      ),

    function_parameter: ($) =>
      choice(
        seq(
          repeat(
            choice(
              $.argument_mode,
              $._table_option
            )
          ),
          field("name", $.identifier),
          optional($.type_tuning),
          repeat($.parameter_tuning)
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
        _list(choice($.string_literal, $._name), ",")
      ),

    implements: ($) =>
      seq(
        kw("IMPLEMENTS"),
        _list(choice($.string_literal, $._name), ",")
      ),

    // function_parameter_mode: ($) =>
    //   choice(alias($._input_keyword, "INPUT"), alias($._output_keyword, "OUTPUT"), kw("INPUT-OUTPUT")),

    data_relation: ($) =>
      seq(
        kw("DATA-RELATION"),
        optional($.identifier),
        alias($._for_keyword, "FOR"),
        _list($._name, ","),
        kw("RELATION-FIELDS"),
        seq(
          "(",
          _list($._name, ","),
          ")"
        )
      ),

    object_access: ($) =>
      prec(2, seq(
        field(
          "object",
          choice($.new_expression, $.function_call, $.constant, $._name)
        ),
        repeat1(seq(alias($._namecolon, ":"), field("property", $.identifier)))
      )),

    member_access: ($) =>
      seq(
        field("object", $.identifier),
        repeat1(
          seq(alias($._namedoublecolon, "::"), field("property", $.identifier))
        )
      ),

    case_condition: ($) =>
      seq(
        optional(seq(kw("OR"), kw("WHEN"))),
        choice($._literal, $.boolean_literal, $.logical_expression, $.comparison_expression, $.unary_expression, $.object_access, $.null_expression, $.function_call)
      ),

    case_when_branch: ($) =>
      seq(kw("WHEN"), repeat1($.case_condition), kw("THEN"), $._statement_body),

    case_otherwise_branch: ($) => seq(kw("OTHERWISE"), $._statement_body),

    where_clause: ($) => seq(kw("WHERE"), field("condition", $._expression)),

    sort_column: ($) =>
      seq(field("column", choice($._name, $.function_call, $.ternary_expression)), optional($.sort_order)),

    sort_clause: ($) =>
      seq(optional(kw("BREAK")), seq(kw("BY"), repeat1($.sort_column))),

    using_field: ($) =>
      seq(
        optional($._frame),
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
      prec.right(
      seq(
        repeat($.annotation), 
        field("name", $.identifier),
        field(
          "value",
          optional(
            seq(
              kw("="),
              _list(choice($.identifier, $._literal, $.null_expression),",")
            )
          )
        ),
        repeat($.annotation), 
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
        optional($._getter_body),
        $._terminator
      ),

    _getter_body: ($) =>
      seq(
        optional(alias($.function_parameters, $.parameters)),
        $.body,
        kw("END"),
        optional(kw("GET"))
      ),

    setter: ($) =>
      seq(
        optional($.access_tuning),
        kw("SET"),
        optional($._setter_body),
        $._terminator
      ),

    _setter_body: ($) =>
      seq(
        optional(alias($.function_parameters, $.parameters)),
        $.body,
        kw("END"),
        optional(kw("SET"))
      ),

    _on_phrase: ($) =>
      choice(
        $.on_error_phrase,
        $.on_quit_phrase,
        $.on_stop_phrase,
        $.on_endkey_phrase
      ),

    action_phrase: ($) =>
      choice(
        seq(kw("LEAVE"), optional(field("label", $.identifier))),
        seq(kw("NEXT"), optional(field("label", $.identifier))),
        seq(kw("RETRY"), optional(field("label", $.identifier))),
        seq(
          alias($._return_keyword, "RETURN"),
          $._return_action
        )
      ),

    _return_action: ($) =>
      choice(
        seq(kw("ERROR"), optional($._return_value_expression)),
        kw("NO-APPLY"),
        $._return_value_expression
      ),

    // PHRASES

    while_phrase: ($) => seq(kw("WHILE"), field("condition", $._expression)),

    to_phrase: ($) =>
      seq(
        $.assignment,
        kw("TO"),
        optional(choice(kw("BROWSE"), kw("SELECTION-LIST"), kw("LIST-BOX"))),
        choice($.function_call, $._integer_literal, $._name, $.object_access, $.multiplicative_expression, $.additive_expression),
        optional(seq(kw("BY"), choice($._integer_literal, $.unary_expression)))
      ),

    combo_box_phrase: ($) =>
      seq(
        kw("COMBO-BOX"),
        repeat(
          choice(
            $._list_items,
            $.size_phrase,
            kw("SORT"),
            kw("SIMPLE"),
            kw("DROP-DOWN"),
            kw("DROP-DOWN-LIST"),
            seq(kw("AUTO-COMPLETION"), optional(kw("UNIQUE-MATCH")))
          )
        )
      ),

    // editor_phrase: ($) =>
    //   seq(
    //     choice($.size_phrase,
    //       // seq($._inner_chars, $._inner_lines)
    //     ),
    //     repeat(
    //       choice(
    //         seq(kw("BUFFER-CHARS"), $.number_literal),
    //         seq(kw("BUFFER-LINES"), $.number_literal),
    //         kw("LARGE"),
    //         // $._max_chars,
    //         kw("NO-BOX"),
    //         kw("NO-WORD-WRAP"),
    //         kw("SCROLLBAR-HORIZONTAL"),
    //         kw("SCROLLBAR-VERTICAL"),
    //         // $._tooltip
    //       )
    //     )
    //   ),

    radio_set_phrase: ($) =>
      seq(
        kw("RADIO-SET"),
        optional(choice(seq(kw("HORIZONTAL"), optional(kw("EXPAND"))), kw("VERTICAL"))),
        seq(
          kw("RADIO-BUTTONS"),
          field("label", choice($.string_literal, $.identifier)), 
          ",", 
          field("value", choice($.string_literal, $.identifier, $._expression)),
          repeat(seq(
            ",", 
            field("label", choice($.string_literal, $.identifier)), 
            ",", 
            field("value", choice($.string_literal, $.identifier, $._expression))
          ))
        ),
        optional($.size_phrase)
      ),

    // selection_list_phrase: ($) =>
    //   seq(
    //     kw("SELECTION-LIST"),
    //     repeat1(
    //       choice(
    //         kw("SINGLE"),
    //         kw("MULTIPLE"),
    //         kw("NO-DRAG"),
    //         $._list_items,
    //         kw("SCROLLBAR-HORIZONTAL"),
    //         kw("SCROLLBAR-VERTICAL"),
    //         $.size_phrase,
    //         // seq($._inner_chars, $._inner_lines),
    //         kw("SORT"),
    //         $._tooltip
    //       )
    //     ),
    //   ),

    // slider_phrase: ($) =>
    //   seq(
    //     kw("SLIDER"),
    //     seq(kw("MAX-VALUE"), $.number_literal, kw("MIN-VALUE"), $.number_literal),
    //     repeat(
    //       choice(
    //         kw("HORIZONTAL"),
    //         kw("VERTICAL"),
    //         kw("NO-CURRENT-VALUE"),
    //         kw("LARGE-TO-SMALL"),
    //         seq(
    //           kw("TIC-MARKS"),
    //           choice(kw("NONE"), kw("TOP"), kw("BOTTOM"), kw("LEFT"), kw("RIGHT"), kw("BOTH")),
    //           optional(seq(kw("FREQUENCY"), $.number_literal))
    //         ),
    //         $._tooltip,
    //         $.size_phrase
    //       )
    //     )
    //   ),

    view_as_phrase: ($) =>
      seq(
        kw("VIEW-AS"),
        choice(
          $.combo_box_phrase,
          // $.editor_phrase,
          $.radio_set_phrase,
          // $.selection_list_phrase,
          // $.slider_phrase,
          // seq(
          //   kw("FILL-IN"),
          //   repeat(
          //     choice(
          //       kw("NATIVE"),
          //       $.size_phrase,
          //       $._tooltip
          //     )
          //   )
          // ),
          seq(
            kw("TEXT"),
            // repeat(choice(kw("NATIVE"), $.size_phrase, $._tooltip))
          ),
          // seq(kw("TOGGLE-BOX"), repeat(choice(kw("NATIVE"), $.size_phrase, $._tooltip))),
        )
      ),

    on_error_phrase: ($) =>
      seq(
        kw("ON"),
        kw("ERROR"),
        kw("UNDO"),
        optional(field("label", $.identifier)),
        ",",
        choice(
          $.action_phrase,
          kw("THROW")
        )
      ),

    on_stop_phrase: ($) =>
      seq(
        kw("ON"),
        kw("STOP"),
        kw("UNDO"),
        optional(field("label", $.identifier)),
        ",",
        $.action_phrase
      ),

    on_quit_phrase: ($) =>
      seq(
        kw("ON"),
        kw("QUIT"),
        optional(seq(kw("UNDO"), optional($.identifier))),
        ",",
        $.action_phrase
      ),

    on_endkey_phrase: ($) =>
      seq(
        kw("ON"),
        kw("ENDKEY"),
        optional(seq(kw("UNDO"), optional($.identifier))),
        ",",
        $.action_phrase
      ),

    frame_phrase: ($) =>
      seq(
        kw("WITH"),
        repeat1(
          choice(
            seq(kw("ACCUM"), optional($._integer_literal)),
            // $.at_phrase, // TODO
            seq(kw("CANCEL-BUTTON"), $.identifier),
            kw("CENTERED"),
            // $._bgcolor,
            // color specification
            $._position,
            seq($.number_literal, kw("COLUMNS")),
            kw("CONTEXT-HELP"),
            // seq(kw("CONTEXT-HELP-FILE"), $.identifier),
            seq(kw("DEFAULT-BUTTON"), $.identifier),
            // kw("DROP-TARGET"),
            // kw("EXPORT"),
            seq(kw("WIDGET-ID"), $.number_literal),
            $._font,
            $._frame,
            // kw("INHERIT-BGCOLOR"),
            // kw("NO-INHERIT-BGCOLOR"),
            // kw("INHERIT-FGCOLOR"),
            // kw("NO-INHERIT-FGCOLOR"),
            // kw("KEEP-TAB-ORDER"),
            kw("NO-BOX"),
            kw("NO-HIDE"),
            kw("NO-LABELS"),
            // kw("USE-DICT-EXPS"),
            kw("NO-VALIDATE"),
            // kw("NO-AUTO-VALIDATE"),
            // kw("NO-HELP"),
            // kw("NO-UNDERLINE"),
            // kw("OVERLAY"),
            // kw("PAGE-BOTTOM"),
            // kw("PAGE-TOP"),
            // seq(kw("RETAIN"), $.number_literal),
            // kw("SCREEN-IO"),
            kw("STREAM-IO"),
            seq(kw("SCROLL"), $.number_literal),
            kw("SCROLLABLE"),
            kw("SIDE-LABELS"),
            $.size_phrase,
            seq(kw("STREAM"), field("stream", $.identifier)),
            seq(kw("STREAM-HANDLE"), field("stream_handle", $.identifier)),
            // kw("THREE-D"),
            // title phrase
            kw("TOP-ONLY"),
            kw("USE-TEXT"),
            // seq(kw("V6FRAME"), optional(choice(kw("USE-REVVIDEO"), kw("USE-UNDERLINE")))),
            seq(kw("VIEW-AS"), kw("DIALOG-BOX")),
            seq(kw("WIDTH"), $.number_literal),
            seq(kw("IN-WINDOW"), $.identifier),
            // $._option_with_number,
            // $._color_option
          )
        )
      ),

      // _option_with_number: ($) =>
      //   seq(
      //     choice(
      //       kw("WIDTH"),
      //       kw("SCROLL"),
      //       kw("RETAIN"),
      //       kw("WIDGET-ID")
      //     ),
      //     $.number_literal
      //   ),

      // _color_option: ($) =>
      //   choice(
      //     kw("INHERIT-BGCOLOR"),
      //     kw("NO-INHERIT-BGCOLOR"),
      //     kw("INHERIT-FGCOLOR"),
      //     kw("NO-INHERIT-FGCOLOR"),

      //   ),

    stop_after_phrase: ($) => seq(kw("STOP-AFTER"), $._integer_literal),

    do_for_phrase: ($) =>
      seq(
        kw("FOR"),
        _list($._name, ",")
      ),

    in_frame_phrase: ($) =>
    seq(
        choice($.object_access, $.function_call),
        kw("IN"),
        $._frame
    ),

      // widget_phrase: ($) =>
      //   choice(
      //     $._frame,
      //     seq(
      //       optional(alias($._field_keyword, "FIELD")),
      //       $.identifier,
      //       optional(seq(kw("IN"), $._frame))
      //     ),
      //     seq(
      //       $.identifier,
      //       optional(seq(kw("IN"), kw("BROWSE"), $.identifier))
      //     ),
      //     seq(choice(kw("MENU"), kw("SUB-MENU")), $.identifier),
      //     seq(kw("MENU-ITEM"), $.identifier, optional(seq(kw("IN"), kw("MENU"), $.identifier))),
      //     _list($.identifier, ",")
      //   ),

      referencing_phrase: ($) =>
        seq(
          alias($._new_keyword, "NEW"), optional(kw("BUFFER")),
          $.identifier,
          alias($._old_keyword, "OLD"), optional(kw("BUFFER")),
          $.identifier,
        ),

      // of_phrase: ($) =>
      //   seq(
      //     kw("OF"),
      //     $.widget_phrase,
      //   ),

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
          _list($._name, ","),
          optional($.referencing_phrase),
          optional(kw("OVERRIDE")),
          choice($.do_block, kw("REVERT"))
        )),

      _on_statement_widget_phrase: ($) =>
        prec(2, seq(
          _list(choice($.identifier, $.constant, $.string_literal), ","),
          choice(
            seq(kw("OF"), kw("FRAME"), choice($._name, $.constant)),
            seq(kw("OF"), _list(choice($._name, $.constant), ","), optional(seq(kw("IN"), kw("FRAME"), choice($._name, $.constant))))
          ),
          repeat(
            seq(
              kw("OR"),
              _list(choice($.identifier, $.constant, $.string_literal), ","),
              choice(
                seq(kw("OF"), kw("FRAME"), choice($._name, $.constant)),
                seq(kw("OF"), _list(choice($._name, $.constant), ","), optional(seq(kw("IN"), kw("FRAME"), choice($._name, $.constant))))
              )
            )
          ),
          optional(kw("ANYWHERE")),
          choice($.do_block, $.run_statement, prec(2, $._statement), kw("REVERT"), seq(kw("PERSISTENT"), $.run_statement))
        )),

        // TODO: Refactor
      // image_phrase: ($) =>
      //   seq(
      //     choice(kw("IMAGE"), kw("IMAGE-UP"), kw("IMAGE-DOWN"), kw("IMAGE-INSENSITIVE")),
      //     seq(kw("FILE"), $.string_literal),
      //     optional(
      //       $.size_phrase
      //     ),
      //     optional(
      //       seq(
      //         kw("FROM"),
      //         repeat1($._position)
      //       )
      //     )
      //   ),

      _position: ($) =>
        seq(
          choice(
            kw("X"),
            kw("Y"),
            kw("ROW"),
            kw("COLUMN")
          ),
          $.number_literal
        ),

      size_phrase: ($) =>
        seq(
          choice(
            kw("SIZE"),
            kw("SIZE-CHARS"),
            kw("SIZE-PIXELS"),
            kw("IMAGE-SIZE"),
            kw("IMAGE-SIZE-CHARS"),
            kw("IMAGE-SIZE-PIXELS")
          ),
          field("width", $.number_literal),
          kw("BY"),
          field("height", $.number_literal)
        ),

      preselect_phrase: ($) =>
        seq(
          kw("PRESELECT"),
          _list($._for_phrase, ","),
        ),

      _for_phrase: ($) =>
        seq(
          optional(field("type", choice(kw("EACH"), kw("FIRST"), kw("LAST")))),
          field("table", $._name),
          repeat(
            choice(
              $.of,
              $.query_tuning,
              $.where_clause,
              $.sort_clause
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

    // OPTIONAL SEQUENCES

    // _bgcolor: ($) => seq(kw("BGCOLOR"), $._integer_literal),

    _column_label: ($) => seq(kw("COLUMN-LABEL"), $.string_literal),

    // _context_help_id: ($) => seq(kw("CONTEXT-HELP-ID"), $._integer_literal),

    // _dcolor: ($) => seq(kw("DCOLOR"), $._integer_literal),

    // _decimals: ($) => seq(kw("DECIMALS"), $.number_literal),

    _extent: ($) => seq(kw("EXTENT"), $.number_literal),

    // _fgcolor: ($) => seq(kw("FGCOLOR"), $._integer_literal),

    _font: ($) => seq(kw("FONT"), $._integer_literal),

    _format: ($) => seq(kw("FORMAT"), $.string_literal),

    _frame: ($) => seq(kw("FRAME"), field("frame", choice($.identifier, $.constant))),

    _initial: ($) =>
      seq(
        choice(kw("INITIAL"), kw("INIT")),
        choice(
          $._literal,
          $.array_literal,
          $.boolean_literal,
          $.null_expression,
          $.identifier,
          $.object_access
        )),

    // _inner_chars: ($) => seq(kw("INNER-CHARS"), $.number_literal),

    // _inner_lines: ($) => seq(kw("INNER-LINES"), $.number_literal),

    _label: ($) => seq(kw("LABEL"), _list($.string_literal, ",")),

    _list_items: ($) =>
      seq(
        choice(
          kw("LIST-ITEMS"),
          kw("LIST-ITEM-PAIRS")),
        _list(choice($._literal, $._expression), ",")
      ),

    // _max_chars: ($) => seq(kw("MAX-CHARS"), $.number_literal),

    // _pfcolor: ($) => seq(kw("PFCOLOR"), $._integer_literal),

    _serialize_name: ($) => seq(kw("SERIALIZE-NAME"), $.string_literal),

    // _tooltip: ($) => seq(kw("TOOLTIP"), $.string_literal),

    // DEFINITIONS

    _definition: ($) =>
      choice(
        $.variable_definition,
        $.buffer_definition,
        $.browse_definition,
        // $.button_definition,
        $.query_definition,
        $.rectangle_definition,
        $.temp_table_definition,
        $.workfile_definition,
        $.property_definition,
        $.data_source_definition,
        $.event_definition,
        $.dataset_definition,
        $.stream_definition,
        // $.image_definition,
        $.frame_definition,
        $.parameter_definition
      ),

    buffer_definition: ($) =>
      seq(
        $._define,
        repeat($._tuning),
        kw("BUFFER"),
        field("name", $.identifier),
        alias($._for_keyword, "FOR"),
        optional(kw("TEMP-TABLE")),
        field("table", $._name),
        $._terminator
      ),

    // button_definition: ($) =>
    //   seq(
    //     $._define,
    //     repeat($._tuning),
    //     kw("BUTTON"),
    //     field("name", $.identifier),
    //     repeat($.button_tuning),
    //   ),

    dataset_definition: ($) =>
      seq(
        $._define,
        repeat($._tuning),
        kw("DATASET"),
        field("name", $.identifier),
        alias($._for_keyword, "FOR"),
        _list($._name, ","),
        optional($.data_relation),
        $._terminator
      ),

    data_source_definition: ($) =>
      seq(
        $._define,
        repeat($._tuning),
        kw("DATA-SOURCE"),
        $.identifier,
        alias($._for_keyword, "FOR"),
        repeat($._data_source_definition_option),
        $._terminator
      ),

    _data_source_definition_option: ($) =>
      choice(
        seq(kw("QUERY"), $.identifier),
        _list($._name, ",")
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
      $._define,
      repeat($._tuning),
      kw("EVENT"),
      field("name", $.identifier),
        optional(
            choice(
              seq(optional(kw("SIGNATURE")), kw("VOID"), alias($.function_parameters, $.parameters)),
              seq(optional(kw("DELEGATE")), optional(kw("CLASS")), $._name),
          )
        ),
        $._terminator
      ),

    frame_definition: ($) =>
      seq(
        $._define,
        repeat($._tuning),
        kw("FRAME"),
        field("name", choice($.identifier, $.constant)),
        repeat(choice($.identifier, $.constant, $.object_access)),
        optional(seq(
          kw("WITH"),
          repeat1(choice(
            $.size_phrase,
            seq(kw("SIZE-PIXELS"), $.number_literal, kw("BY"), $.number_literal),
            kw("NO-BOX"),
            seq(kw("FONT"), $.number_literal),
            seq(kw("BGCOLOR"), $.number_literal),
            seq(kw("FGCOLOR"), $.number_literal),
            kw("SCROLLABLE"),
            kw("RESIZABLE")
          ))
        )),
        optional(seq(kw("AT"), kw("COLUMN"), field("column", choice($.number_literal, $.identifier)))),
        optional(seq(kw("ROW"), field("row", choice($.number_literal, $.identifier)))),
        $._terminator
      ),

    // image_definition: ($) =>
    //   seq(
    //     $._define,
    //     repeat($._tuning),
    //     kw("IMAGE"),
    //     field("name", $.identifier),
    //     $._image_definition_option,
    //     // repeat($.image_tuning),
    //     $._terminator
    //   ),

    // _image_definition_option: ($) =>
    //   choice(
    //     $.size_phrase,
    //     $.image_phrase,
    //     seq(kw("LIKE"), $.identifier)
    //   ),

    parameter_definition: ($) =>
      seq(
        $._define,
        optional(
          choice(alias($._input_keyword, "INPUT"), alias($._output_keyword, "OUTPUT"), kw("INPUT-OUTPUT"), alias($._return_keyword, "RETURN"))
        ),
        choice(kw("PARAMETER"), kw("PARAM")),
        optional($._parameter_definition_option),
        optional(alias($._for_keyword, "FOR")),
        field("name", $.identifier),
        choice(
          seq($.type_tuning, repeat($.variable_tuning)),
          repeat($.parameter_tuning)
        ),
        $._terminator
      ),

    _table_option: ($) =>
      choice(
        kw("TABLE"),
        kw("TABLE-HANDLE"),
        kw("DATASET-HANDLE"),
        kw("DATASET")
      ),

    _parameter_definition_option: ($) =>
      choice(
        seq(kw("BUFFER"), field("buffer", $.identifier)),
        kw("TABLE"),
        kw("TABLE-HANDLE"),
        seq(kw("DATASET"), optional(token.immediate(kw("-HANDLE"))))
      ),

    browse_definition: ($) =>
      seq(
        $._define,
        repeat($._tuning),
        kw("BROWSE"),
        field("name", $.identifier),
        optional(seq(kw("QUERY"), field("query", $.identifier))),
        optional(seq(
          kw("DISPLAY"),
          repeat1(
            seq(
              $._expression,
              optional(seq(kw("COLUMN-LABEL"), $.string_literal))
            )
          )
        )),
        optional(seq(
          kw("WITH"),
          repeat1(choice(
            seq($.number_literal, kw("DOWN")),
            seq(kw("WIDTH"), $.number_literal),
            kw("MULTIPLE"),
            kw("SINGLE")
          ))
        )),
        $._terminator
      ),

    rectangle_definition: ($) =>
      seq(
        $._define,
        repeat($._tuning),
        kw("RECTANGLE"),
        field("name", $.identifier),
        optional(seq(
          kw("SIZE"),
          $.number_literal,
          kw("BY"),
          $.number_literal
        )),
        $._terminator
      ),

    property_definition: ($) =>
      seq(
        $._define,
        repeat($._tuning),
        kw("PROPERTY"),
        field("name", $.identifier),
        $.type_tuning,
        repeat($._value_tuning),
        choice(repeat1(choice($.getter, $.setter)), $._terminator)
      ),

    query_definition: ($) =>
      seq(
        $._define,
        repeat($._tuning),
        kw("QUERY"),
        field("name", $.identifier),
        alias($._for_keyword, "FOR"),
        $.identifier,
        repeat($.query_definition_tuning),
        $._terminator
      ),

    stream_definition: ($) =>
      seq(
        $._define,
        repeat($._tuning),
        kw("STREAM"),
        field("name", $.identifier),
        $._terminator
      ),

    temp_table_definition: ($) =>
      seq(
        $._define,
        repeat($._tuning),
        optional($.serialization_tuning),
        kw("TEMP-TABLE"),
        field("name", $.identifier),
        repeat($.temp_table_tuning),
        repeat($._temp_table_member),
        $._terminator
      ),

    _temp_table_member: ($) =>
      choice(
        $.field_clause,
        $.index_clause,
        $.include
      ),

    variable_definition: ($) =>
      seq(
        $._define,
        repeat($._tuning),
        choice(kw("VARIABLE"), alias($._var_keyword, "VAR")),
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
        $._define,
        repeat($._tuning),
        choice(kw("WORKFILE"), kw("WORK-TABLE")),
        field("name", $.identifier),
        repeat($.workfile_tuning),
        $._terminator
      ),

    // STATEMENTS

    message_statement:($) =>
      seq(
        kw("MESSAGE"),
        repeat1(
          choice(
            $._message_statement_expression,
            seq(
              kw("SKIP"),
              optional(seq("(", $._integer_literal, ")"))
            )
          )
        ),
        repeat($._message_tuning),
        optional(seq(
          kw("IN"),
          kw("WINDOW"),
          $._name
        )),
        $._terminator
    ),

    null_statement: ($) => seq($.object_access, $._terminator),

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
        field("name", choice($.string_literal, $._name)),
        optional($.inherits),
        alias($.interface_body, $.body),
        $._block_terminator
      ),

    class_statement: ($) =>
      seq(
        kw("CLASS"),
        field("name", choice($.string_literal, $._name)),
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
        optional(kw("PUBLIC")),
        $.identifier,
        seq("(", ")"),
        $.body,
        $._block_terminator
      ),

    method_statement: ($) =>
      seq(
        kw("METHOD"),
        repeat($._tuning),
        alias($._type, $.return_type),
        optional($._extent),
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
        optional($.body),
        $._block_terminator
      ),

    case_statement: ($) =>
      seq(
        kw("CASE"),
        $._expression,
        alias($.case_body, $.body),
        $._block_terminator
      ),

    variable_assignment: ($) => seq($.assignment, optional(kw("NO-ERROR")), $._terminator),

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
                $.array_access,
                $.in_frame_phrase
              )
            )
          ),
          $.assignment_operator,
          prec.right(choice($._expression, $.include)),
          optional($.when_expression),
          optional(seq(kw("IN"), $._frame))
        )
      ),

    function_call_statement: ($) => seq($.function_call, $._terminator),

    function_statement: ($) =>
      seq(
        kw("FUNCTION"),
        field("name", $.identifier),
        $.return_type,
        optional($._extent),
        optional(alias($.function_parameters, $.parameters)),
        $._function_option
      ),

    _function_option: ($) =>
      choice(
        seq(
          optional(alias($.dot_body, $.body)),
          $._block_terminator),
          seq(
            choice(seq(kw("IN"), $.identifier), kw("FORWARD")),
            $._terminator
          )
      ),

    repeat_statement: ($) =>
      seq(
        optional($.label),
        kw("REPEAT"),
        repeat($._repeat_phrase),
        optional($.preselect_phrase),
        optional($.while_phrase),
        repeat($._on_phrase),
        $.body,
        $._block_terminator
      ),

    _repeat_phrase: ($) =>
      choice(
        $.to_phrase,
        $.repeat_tuning
        // $.frame_phrase
      ),

    return_statement: ($) =>
      prec(1, seq(
        alias($._return_keyword, "RETURN"),
        optional($._return_action),
        $._terminator
      )),

    input_output_statement: ($) =>
      seq(
        choice(alias($._input_keyword, "INPUT"), alias($._output_keyword, "OUTPUT")),
        optional(
          seq(
            choice(kw("STREAM"), kw("STREAM-HANDLE")),
            field("name", $.identifier)
          ),
        ),
        $._input_output_option,
        repeat($.stream_flag),
        repeat($.stream_tuning),
        optional($.constant),
        $._terminator
      ),

    _input_output_option: ($) =>
      choice(
        kw("CLOSE"),
        seq(
          choice(kw("FROM"), kw("TO")),
          choice($.string_literal, $.function_call)
        ),
        seq(
          kw("THROUGH"),
          choice($.identifier, seq(kw("VALUE"), "(", $._expression, ")")), 
          repeat(
            choice(
            $.identifier,
            $.string_literal,
            $.number_literal,
            seq(kw("VALUE"), "(", $._expression, ")")
            )
          ),
          optional(seq(">", $.identifier)) 
        )
      ),

    for_statement: ($) =>
      seq(
        optional($.label),
        alias($._for_keyword, "FOR"),
        _list($._for_phrase, ","),
        repeat(choice($._on_phrase, $.frame_phrase, $.while_phrase)),
        $.body,
        $._block_terminator
      ),

    find_statement: ($) =>
      seq(
        kw("FIND"),
        field("type", optional($._find_type)),
        field("table", $._name),
        repeat(
          choice(
            $.of,
            $.query_tuning,
            $.where_clause
          )
        ),
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
        repeat1(choice($.assignment, $.preprocessor_directive)),
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
        choice($._name, $._binary_expression),
        seq(
          "(",
          repeat1($.accumulate_aggregate),
          ")"
        ),
        $._terminator
      ),

    undo_statement: ($) =>
      seq(
        kw("UNDO"),
        optional(field("label", $.identifier)),
        ",",
        choice(
          $.action_phrase,
          seq(kw("THROW"), choice($.new_expression, $.identifier))
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
          // seq(alias("\"WEB-NOTIFY\"", $.string_literal), kw("ANYWHERE"), $._statement_body)
        )
      ),

    prompt_for_statement: ($) =>
      seq(
        kw("PROMPT-FOR"),
        $._name,
        optional($._frame),
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
        _list($.variable, ","),
        $._terminator
      ),

    release_statement: ($) =>
      seq(
        kw("RELEASE"),
        $.identifier,
        optional(kw("NO-ERROR")),
        $._terminator
      ),

    run_statement: ($) =>
      seq(
        kw("RUN"),
        field(
          "procedure",
          choice($._name, $.function_call, $.file_name, $.string_literal)
        ),
        optional($.function_call_argument),
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
        repeat($._do_tuning),
        repeat($._on_phrase),
        optional($.frame_phrase),
        $.body,
        $._block_terminator
      ),

    _do_tuning: ($) =>
      choice(
        $.do_for_phrase,
        $.preselect_phrase,
        $.to_phrase,
        $.while_phrase,
        $.stop_after_phrase,
        kw("TRANSACTION")
      ),

    if_statement: ($) =>
      seq(
        $._if_phrase,
        $._statement_body,
        repeat($.else_statement)
      ),

    _if_phrase: ($) =>
      seq(
        kw("IF"),
        field("condition", $._expression),
        kw("THEN")
      ),

    else_statement: ($) =>
      prec(
        1,
        seq(
          kw("ELSE"),
          optional($._if_phrase),
          $._statement_body
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

    _unary_minus_expression: ($) =>
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
          seq(kw("-"), prec.left($._unary_minus_expression))
        ),
        prec.left(
          PREC.LOGICAL,
          seq(kw("NOT"), prec.left(PREC.LOGICAL, $._expression))
        )
      ),

    ambiguous_expression: ($) => seq(kw("AMBIGUOUS"), $._name),

    temp_table_expression: ($) =>
      seq(kw("TEMP-TABLE"), field("table", choice($.identifier, $.object_access))),

    query_expression: ($) =>
      seq(kw("QUERY"), field("query", choice($.identifier, $.object_access))),

    stream_expression: ($) =>
      seq(kw("STREAM"), field("stream", choice($.identifier, $.object_access))),

    buffer_expression: ($) =>
      seq(kw("BUFFER"), field("buffer", choice($.identifier, $.object_access))),

    current_changed_expression: ($) => seq(kw("CURRENT-CHANGED"), $._name),

    locked_expression: ($) => seq(kw("LOCKED"), $._name),

    dataset_expression: ($) => prec(-1, seq(token(seq(/[Dd][Aa][Tt][Aa][Ss][Ee][Tt]/, /\s/)), $._name)),

    when_expression: ($) => seq(kw("WHEN"), $._expression),


    input_expression: ($) =>
      seq(
        alias($._input_keyword, "INPUT"),
        optional($._frame),
        field("field", $._name)
      ),

    additive_expression: ($) =>
      prec.left(
        PREC.ADD,
        seq($._expression, $._additive_operator, $._expression)
      ),

    multiplicative_expression: ($) =>
      prec.left(
        PREC.MULTI,
        seq($._expression, $._multiplicative_operator, $._expression)
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
        $._can_find_body,
        ")"
      ),

    _can_find_body: ($) =>
      seq(
        optional(choice(kw("FIRST"), kw("LAST"))),
        field("table", $._name),
        optional(field("constant", $._literal)),
        repeat(choice($.query_tuning, $.of, $.where_clause)),
      ),

    accumulate_expression: ($) =>
      seq(kw("ACCUM"), $.accumulate_aggregate, $._expression),

    available_expression: ($) =>
      seq(
        choice(kw("AVAIL"), kw("AVAILABLE")),
        choice($.identifier, $.parenthesized_expression),
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

    _return_value_expression: ($) =>
      choice(
        $.string_literal,
        $.number_literal,
        $.boolean_literal,
        $.null_expression,
        $.dataset_expression,
        $.temp_table_expression,
        $.query_expression,
        $.stream_expression,
        $.buffer_expression,
        $.identifier,
        $.function_call,
        $.object_access,
        $.member_access,
        $.qualified_name,
        $.array_access,
        $.ternary_expression,
        $.new_expression,
        $.parenthesized_expression,
        $.unary_expression,
        $._binary_expression
      ),

  _message_statement_expression: ($) => 
    choice(
      $.unary_expression,
      $.null_expression,
      $.ternary_expression,
      $.available_expression,
      $.accumulate_expression,
      $.parenthesized_expression,
      $.ambiguous_expression,
      $.current_changed_expression,
      $.locked_expression,
      $.can_find_expression,
      $.additive_expression,
      $.multiplicative_expression,
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
        $.in_frame_phrase,

        $._name,
        $.constant
      ),

    _statement: ($) =>
      choice(
        $.var_statement,
        $.message_statement,
        $.null_statement,
        $.procedure_statement,
        $.function_statement,
        $.function_call_statement,
        $.return_statement,
        $.if_statement,
        $.for_statement,
        $.repeat_statement,
        $.find_statement,
        $.case_statement,
        $.input_output_statement,
        $.assign_statement,
        $.catch_statement,
        $.finally_statement,
        $.accumulate_statement,
        $.undo_statement,
        $.error_scope_statement,
        $.using_statement,
        $.on_statement,
        $.prompt_for_statement,
        $.release_statement,
        $.run_statement,
        $.enum_statement,
        $.abl_statement,

        $.variable_assignment,
        $.preprocessor_directive,
        $.include,
        $.annotation //TODO: Check should it be in supertype
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
