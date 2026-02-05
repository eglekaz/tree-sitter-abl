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
    $._augmented_assignment,
    $._escaped_string
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
    // [$.dataset_expression, $.object_access],
    [$.in_frame_phrase, $._expression],
    [$.in_frame_phrase, $._message_statement_expression],
    [$.include, $.constant],
    [$.include_argument],
    [$.include_argument, $._constant_value],
    [$._literal, $._expression],
    [$._update_space_skip],

    [$._message_statement_expression, $._expression],
    [$._message_statement_expression, $._binary_expression],
    [$._binary_expression, $._expression],
  ],

  rules: {
    // source_code: ($) => repeat(choice($._statement, $.class_statement, $._definition, $.do_block, $.interface_statement, $.method_statement, $.constant)),
    source_code: ($) => repeat1(choice($._statement, $._definition)),

    body: ($) => seq(":", repeat(choice($._statement, $._definition, $.do_block, prec(-1, $.annotation)))),

    _statement_body: ($) => choice($.do_block, prec(2, $._statement), $.constant),

    dot_body: ($) => seq(choice(":", "."), repeat(choice($._statement, $._definition))),

    class_body: ($) =>
      seq(
        ":",
        repeat(
          choice(
            $._definition,
            // $.var_statement,
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

    // _terminator: ($) => /\s*\./,
    _terminator: ($) => /\./,

    _block_terminator: ($) =>
      seq(
        $._END,
        optional(
          choice(
            $._FUNCTION,
            $._PROCEDURE,
            $._CASE,
            $._CLASS,
            $._ENUM,
            $._INTERFACE,
            $._CONSTRUCTOR,
            $._DESTRUCTOR,
            $._CATCH,
            $._FINALLY
          )
        ),
        "."
      ),

    // OPERATORS

    _logical_operator: ($) =>
      prec.left(
        choice($._AND, $._OR)
      ),

    assignment_operator: ($) => choice("=", $._augmented_assignment),

    _additive_operator: ($) => choice("+", "-"),

    _multiplicative_operator: ($) => choice("*", "/", $._MODULO, $._MOD),

    _comparison_operator: ($) =>
      choice(
        "<",
        "<=",
        "<>",
        "=",
        ">",
        ">=",
        $._LT,
        $._LE,
        $._NE,
        $._EQ,
        $._GT,
        $._GE,
        $._BEGINS,
        $._MATCHES,
        $._CONTAINS
      ),

    // LITERALS / KEYWORDS

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
          seq($._TEST, optional($.annotation_argument)),
          seq($._TESTSUITE, optional($.annotation_argument)),
          $._BEFORE,
          $._BEFOREALL,
          $._BEFOREEACH,
          $._SETUP,
          $._AFTEREACH,
          $._TEARDOWN,
          $._AFTERALL,
          $._AFTER,
          $._IGNORE,
          //These are extra annotations that we added for the OpenEdge ABL Formatter.
          //For more details, please visit: https://marketplace.visualstudio.com/items?itemName=BalticAmadeus.openedge-abl-formatter
          $._ABLFORMATTEREXCLUDESTART,
          $._ABLFORMATTEREXCLUDEEND,
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
              /[iI][fF]/,
              /[^\n]*/,
              repeat(seq(/\n/, /[^\n]*/)),
              /\n\s*/,
              "&",
              /[eE][nN][dD][iI][fF]/
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
      choice($._TRUE, $._FALSE, $._YES, $._NO),

    _integer_literal: ($) => /[0-9]+/,

    _decimal_literal: ($) =>
      seq($._integer_literal, alias($._namedot, "."), $._integer_literal),

    number_literal: ($) => choice($._integer_literal, $._decimal_literal),

    string_literal: ($) => seq($._escaped_string, optional(seq(":", $.string_literal_attribute))),

    string_literal_attribute: ($) =>
      choice(
        seq(
          choice(
            $._R,
            $._L,
            $._C,
            $._T
          ),
          $._integer_literal
        ),
        $._U
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
        // $.new_expression,
        $.number_literal,
        $.string_literal,
        $.boolean_literal,
        $.null_expression,
        // $.function_call,
        $.array_literal,
        // $.array_access,
        $.identifier,
        // $.constant,
        // $._binary_expression
      ),

    range_notation: ($) =>
      seq(
        choice($.identifier, $._integer_literal),
        $._FOR,
        $._integer_literal
      ),

    // _define: ($) =>
    //   choice(
    //     $._DEFINE,
    //     $._DEF,
    //   ),

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
        $.constant
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
        "}"
      )),

    // TODO Refactor
    include_file_path: ($) =>
      prec.right(repeat1(choice(
        $.constant,
        /[A-z-_|0-9|\/\.]+/i
      ))),

    // IDENTIFIERS

    identifier: ($) => /[A-Z|a-z|\-|\\_]{1}[#+&A-Z|a-z|\-|\\_|0-9]*/i,

    constant: ($) =>
      seq("{", optional("&"), $._constant_value, "}"),

    _constant_value: ($) => choice(
      $.identifier,
      $._integer_literal,
      seq($.identifier, "=", choice($.identifier, $._integer_literal, $.string_literal)),
      seq($.identifier, repeat1(choice(/[\s\-()a-zA-Z0-9]+/)))
    ),

    file_name: ($) => /[A-z-_|0-9|\/]+\.[ipwr]/i,

    qualified_name: ($) =>
      seq(
        $.identifier,
        repeat1(seq(alias($._namedot, "."), choice($.identifier, "*")))
      ),

    _name: ($) => choice($.identifier, $.qualified_name),

    // TUNING

    _tuning: ($) =>
      choice(
        $.access_tuning,
        $.scope_tuning,
        $.member_modifier,
        $.constant
      ),

    access_tuning: ($) =>
      choice(
        $._PRIVATE,
        $._PROTECTED,
        $._PUBLIC,
        $._PACKAGE_PRIVATE,
        $._PACKAGE_PROTECTED
      ),

    scope_tuning: ($) =>
      choice($._NEW, $._GLOBAL, $._SHARED, $._STATIC),

    member_modifier: ($) => choice($._ABSTRACT, $._OVERRIDE, $._FINAL),

     class_tuning: ($) =>
      choice(
        $.inherits,
        $.implements,
        $._USE_WIDGET_POOL,
        $._ABSTRACT,
        $._FINAL,
        $._SERIALIZABLE
      ),

    parameter_tuning: ($) =>
      choice(
        $._APPEND,
        $._BIND,
        $._BY_VALUE,
        $._BY_REFERENCE,
        // $._extent
      ),

    accumulate_aggregate: ($) =>
      choice(
        $._AVERAGE,
        $._COUNT,
        $._MAXIMUM,
        $._MINIMUM,
        $._TOTAL,
        $._SUB_AVERAGE,
        $._SUB_COUNT,
        $._SUB_MAXIMUM,
        $._SUB_MINIMUM,
        $._SUB_TOTAL
      ),

    _message_tuning: ($) =>
      choice(
        $.message_color,
        $._message_alert_box,
        $.message_update,
        $.message_pause,
        $._NO_ERROR
    ),

     message_color: ($) =>
      seq(
        $._COLOR,
        $.color_phrase
      ),

    color_phrase: ($) =>
      choice(
        $._NORMAL,
        $._INPUT,
        $._MESSAGES,
        seq(
          // optional(
          //   choice(
          //     kw("BLINK-"),
          //     kw("RVV-"),
          //     kw("UNDERLINE-"),
          //     kw("BRIGHT-")
          //   )
          // ),
          choice($.string_literal, $.identifier)
        ),

        seq(
          $._VALUE,
          "(", $._expression,
          ")")
      ),

    _message_alert_box: ($) =>
      seq(
        $._VIEW_AS,
        $._ALERT_BOX,
        optional($.alert_box_type),
        optional($.alert_box_buttons),
        optional(seq($._TITLE, choice($.string_literal, $.additive_expression)))
      ),

    alert_box_type: ($) =>
      choice(
        $._MESSAGE,
        $._INFORMATION,
        $._INFO,
        $._WARNING,
        $._ERROR,
        $._QUESTION
      ),

    alert_box_buttons: ($) =>
      seq(
        $._BUTTONS,
        choice(
          $._OK,
          $._CANCEL,
          $._OK_CANCEL,
          $._YES_NO,
          $._YES_NO_CANCEL,
          $._OK_HELP,
          $._YES_NO_HELP,
          $.identifier,
          $.string_literal
        )
      ),

    message_update: ($) =>
      seq(
        choice(
          $._UPDATE,
          $._SET
        ),
        $._name,
        repeat(
          choice(
            seq(
              choice(
                $._AS,
                $._LIKE
              ),
              $._type
            ),
            seq(
              $._FORMAT,
              $.string_literal
            ),
            $._AUTO_RETURN
          )
        ),
      ),

    message_pause:($) => $._PAUSE,

    update_tuning: ($) =>
      choice(
        // $.comparison_expression,
        $._update_field,
        $._update_text,
        $._update_constant,
        "^",
        $._update_space_skip
      ),

    _update_field: ($) =>
      seq(
        $._name,
        optional($._format),
        optional($.when_expression)
      ),

    _update_text: ($) =>
      seq(
        $._TEXT,
        "(",
          _list(seq($._name, optional($._format)), ","),
        ")"
      ),

    _update_constant: ($) =>
      seq(
        $.constant,
        optional(
          choice(
            seq($._AT, $._expression),
            seq($._TO, $._expression)
          )
        )
      ),

    _update_space_skip: ($) =>
      seq(
        choice($._SPACE, $._SKIP),
        optional(seq("(", $._integer_literal, ")"))
      ),

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
        $._SERIALIZE_HIDDEN,
        $._serialize_name,
        // seq(kw("XML-DATA-TYPE"), $.string_literal),
        // seq(kw("XML-NODE-TYPE"), $.string_literal),
        // seq(kw("XML-NODE-NAME"), $.string_literal),
        seq($._HELP, $.string_literal),
        seq(optional($._NOT), $._CASE_SENSITIVE),
        seq($._MOUSE_POINTER, $.identifier),
        // kw("TTCODEPAGE"),
        // seq(kw("COLUMN-CODEPAGE"), $.string_literal)
      ),

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
        optional(choice($._IS, $._AS)),
        choice(
          $._PRIMARY,
          $._UNIQUE,
          $._WORD_INDEX
        )
      ),

    of: ($) => seq($._OF, $._name),

    stream_tuning: ($) =>
      choice(
        seq($._LOB_DIR, $.string_literal),
        seq($._NUM_COPIES, $._integer_literal),
        seq($._MAP, $.identifier),
        seq(
          $._CONVERT,
          optional(seq($._TARGET, choice($.identifier, $.string_literal))),
          optional(seq($._SOURCE, choice($.identifier, $.string_literal)))
        ),
      ),

    stream_flag: ($) =>
      choice(
        $._COLLATE,
        $._BINARY,
        $._LANDSCAPE,
        $._PORTRAIT,
        $._APPEND,
        $._ECHO,
        $._NO_ECHO,
        $._KEEP_MESSAGES,
        $._NO_MAP,
        $._PAGED,
        $._UNBUFFERED,
        $._NO_CONVERT
      ),

    _value_tuning: ($) =>
      choice(
        $._initial,
        seq($._DECIMALS, $.number_literal),
        $._extent,
        $._NO_UNDO
      ),

    query_definition_tuning: ($) =>
      choice(
        seq($._FIELDS, $.query_fields),
        seq($._EXCEPT, $.query_fields),
        seq($._CACHE, $.number_literal),
        $._SCROLLING,
        $._RCODE_INFORMATION
      ),

    query_tuning: ($) =>
      choice(
        $._NO_LOCK,
        $._SHARE_LOCK,
        $._EXCLUSIVE_LOCK,
        $._NO_WAIT,
        $._NO_ERROR,
        $._NO_PREFETCH,
        seq($._USE_INDEX, $.identifier),
        $.using
      ),

    workfile_tuning: ($) =>
      choice(
        $.type_tuning,
        $.field_clause
      ),

    repeat_tuning: ($) => seq($._WITH, $._frame_expression),

    run_tuning: ($) =>
      choice(
        $._PERSISTENT,
        $._SINGLE_RUN,
        $._SINGLETON,
        $._ASYNCHRONOUS,
        seq($._SET, $.identifier),
        seq($._ON, $._SERVER, $.identifier),
        seq($._IN, choice($._THIS_PROCEDURE, $.identifier)),
        seq($._EVENT_PROCEDURE, $.string_literal)
      ),

    serialization_tuning: ($) =>
      choice(
        $._SERIALIZABLE,
        $._NON_SERIALIZABLE
      ),

    sort_order: ($) =>
      choice($._ASCENDING, $._DESCENDING, $._DESC, $._ASC),

    temp_table_tuning: ($) =>
      choice(
        $._NO_UNDO,
        // seq(kw("NAMESPACE-URI"), $.string_literal),
        // seq(kw("NAMESPACE-PREFIX"), $.string_literal),
        // seq(kw("XML-NODE-NAME"), $.string_literal),
        $._serialize_name,
        $._REFERENCE_ONLY,
        $.like_phrase,
        $._RCODE_INFORMATION,
        seq($._BEFORE_TABLE, $.identifier),
        $.constant
      ),

    type_tuning: ($) =>
      choice(
        seq($._AS, field("type", choice($._type, $.string_literal))),
        seq($._LIKE, field("type", choice($._type, $.string_literal)))
      ),

    using: ($) =>
      seq(
        $._USING,
        seq($.using_field, repeat(seq($._AND, $.using_field)))
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
        seq($._MOUSE_POINTER, $.identifier),
        $._column_label,
        // kw("DROP-TARGET"),
        seq(optional($._NOT), $._CASE_SENSITIVE),
      ),

    // TYPES

     _type: ($) =>
      choice(
        $.primitive_type,
        seq($.identifier, optional($.identifier)),
        $.qualified_name,
        // $.class_type,
        $.generic_type
      ),

    primitive_type: ($) =>
      choice(
        $._VOID,
        $._LOGICAL,
        $._INTEGER,
        $._INT,
        $._CHARACTER,
        $._CHAR,
        $._DECIMAL,
        $._DATE,
        $._DATETIME,
        $._DATETIME_TZ,
        $._INT64,
        $._LONGCHAR,
        $._MEMPTR,
        $._RAW,
        $._RECID,
        $._ROWID,
        $._HANDLE,
        $._COM_HANDLE
      ),

    class_type: ($) => seq($._CLASS, $._name),

    generic_type: ($) =>
      seq($._name, $.generic_expression),

    return_type: ($) =>
      seq(choice($._RETURNS, $._RETURN), field("type", $._type)),

    _find_type: ($) =>
      choice($._FIRST, $._LAST, $._NEXT, $._PREV, $._CURRENT),

    // PARAMETERS and others

    function_parameters: ($) =>
      seq("(", optional(_list($.function_parameter, ",")), ")"),

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
          $._INPUT,
          $._OUTPUT,
          $._INPUT_OUTPUT,
          $._DATA_SOURCE
        )
      ),

    //   // TODO: Refactor
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
                  $._TABLE,
                  $._TABLE_HANDLE,
                  $._DATASET,
                  $._DATASET_HANDLE
                  // seq(kw("TABLE"), optional(token.immediate(kw("-HANDLE")))),
                  // seq(kw("DATASET"), optional(token.immediate(kw("-HANDLE"))))
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
          $._BUFFER,
          field("buffer", $.identifier),
          $._FOR,
          field("table", $._name),
          optional($._PRESELECT)
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
        $._INHERITS,
        _list(choice($.string_literal, $._name), ",")
      ),

    implements: ($) =>
      seq(
        $._IMPLEMENTS,
        _list(choice($.string_literal, $._name), ",")
      ),

    // Was commented
    // function_parameter_mode: ($) =>
    //   choice(alias($._input_keyword, "INPUT"), alias($._output_keyword, "OUTPUT"), kw("INPUT-OUTPUT")),

    data_relation: ($) =>
      seq(
        $._DATA_RELATION,
        optional($.identifier),
        $._FOR,
        _list($._name, ","),
        $._RELATION_FIELDS,
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
          choice(
            // $.new_expression,
            // $.function_call,
             $.constant, $._name)
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
        optional(seq($._OR, $._WHEN)),
        choice($._literal, $.boolean_literal, $.logical_expression, $.comparison_expression, $.unary_expression, $.object_access, $.null_expression, $.function_call)
      ),

    case_when_branch: ($) =>
      seq($._WHEN, repeat1($.case_condition), $._THEN, $._statement_body),

    case_otherwise_branch: ($) => seq($._OTHERWISE, $._statement_body),

    where_clause: ($) => seq($._WHERE, field("condition", $._expression)),

    sort_column: ($) =>
      seq(field("column", choice($._name, $.function_call, $.ternary_expression)), optional($.sort_order)),

    sort_clause: ($) =>
      seq(optional($._BREAK), seq($._BY, repeat1($.sort_column))),

    using_field: ($) =>
      seq(
        optional($._frame_expression),
        field("field", $._name)
      ),

    field_clause: ($) =>
      seq(
        $._FIELD,
        $.identifier,
        $.type_tuning,
        repeat($.field_option)
      ),

    index_clause: ($) =>
      seq(
        $._INDEX,
        $.identifier,
        repeat($.index_tuning),
        repeat($.index_field)
      ),

    index_field: ($) =>
      seq(
        field("field", $.identifier),
        optional($.sort_order)
      ),

    // TODO: Refactor
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
              "=",
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
          optional($._NO_ERROR)
        )
      ),

    getter: ($) =>
      seq(
        optional($.access_tuning),
        $._GET,
        optional($._getter_body),
        $._terminator
      ),

    _getter_body: ($) =>
      seq(
        optional(alias($.function_parameters, $.parameters)),
        $.body,
        $._END,
        optional($._GET)
      ),

    setter: ($) =>
      seq(
        optional($.access_tuning),
        $._SET,
        optional($._setter_body),
        $._terminator
      ),

    _setter_body: ($) =>
      seq(
        optional(alias($.function_parameters, $.parameters)),
        $.body,
        $._END,
        optional($._SET)
      ),

    _return_action: ($) =>
      choice(
        seq($._ERROR, optional($._return_value_expression)),
        $._NO_APPLY,
        $._return_value_expression
      ),

    // PHRASES

    _on_phrase: ($) =>
      choice(
        $.on_error_phrase,
        $.on_quit_phrase,
        $.on_stop_phrase,
        $.on_endkey_phrase
      ),

    action_phrase: ($) =>
      choice(
        seq($._LEAVE, optional(field("label", $.identifier))),
        seq($._NEXT, optional(field("label", $.identifier))),
        seq($._RETRY, optional(field("label", $.identifier))),
        seq(
          $._RETURN,
          $._return_action
        )
      ),

    while_phrase: ($) => seq($._WHILE, field("condition", $._expression)),

    to_phrase: ($) =>
      seq(
        $.assignment,
        $._TO,
        optional(choice($._BROWSE, $._SELECTION_LIST, $._LIST_BOX)),
        choice($.function_call, $._integer_literal, $._name, $.object_access, $.multiplicative_expression, $.additive_expression),
        optional(seq($._BY, choice($._integer_literal, $.unary_expression)))
      ),

    combo_box_phrase: ($) =>
      seq(
        $._COMBO_BOX,
        repeat(
          choice(
            $._list_items,
            $.size_phrase,
            $._SORT,
            $._SIMPLE,
            $._DROP_DOWN,
            $._DROP_DOWN_LIST,
            seq($._AUTO_COMPLETION, optional($._UNIQUE_MATCH))
          )
        )
      ),

    // Was commented
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
        $._RADIO_SET,
        optional(choice(seq($._HORIZONTAL, optional($._EXPAND)), $._VERTICAL)),
        seq(
          $._RADIO_BUTTONS,
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

    // Was commented
    // selection_list_phrase: ($) =>
    //   seq(
    //     kw("SELECTION-LIST"),
    //     repeat1(
    //       choice(
    //         $._SINGLE,
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

    // Was commented
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
    //           choice(kw("NONE"), $._TOP, kw("BOTTOM"), kw("LEFT"), kw("RIGHT"), kw("BOTH")),
    //           optional(seq(kw("FREQUENCY"), $.number_literal))
    //         ),
    //         $._tooltip,
    //         $.size_phrase
    //       )
    //     )
    //   ),

    view_as_phrase: ($) =>
      seq(
        $._VIEW_AS,
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
            $._TEXT,
            // repeat(choice(kw("NATIVE"), $.size_phrase, $._tooltip))
          ),
          // seq(kw("TOGGLE-BOX"), repeat(choice(kw("NATIVE"), $.size_phrase, $._tooltip))),
        )
      ),

    on_error_phrase: ($) =>
      seq(
        $._ON,
        $._ERROR,
        $._UNDO,
        optional(field("label", $.identifier)),
        ",",
        choice(
          $.action_phrase,
          $._THROW
        )
      ),

    on_stop_phrase: ($) =>
      seq(
        $._ON,
        $._STOP,
        $._UNDO,
        optional(field("label", $.identifier)),
        ",",
        $.action_phrase
      ),

    on_quit_phrase: ($) =>
      seq(
        $._ON,
        $._QUIT,
        optional(seq($._UNDO, optional($.identifier))),
        ",",
        $.action_phrase
      ),

    on_endkey_phrase: ($) =>
      seq(
        $._ON,
        $._ENDKEY,
        optional(seq($._UNDO, optional($.identifier))),
        ",",
        $.action_phrase
      ),

    frame_phrase: ($) =>
      seq(
        $._WITH,
        repeat1(
          choice(
            seq($._ACCUM, optional($._integer_literal)),
            // $.at_phrase, // TODO
            seq($._CANCEL_BUTTON, $.identifier),
            $._CENTERED,
            // $._bgcolor,
            // color specification
            $._position,
            seq($.number_literal, $._COLUMNS),
            $._CONTEXT_HELP,
            // seq(kw("CONTEXT-HELP-FILE"), $.identifier),
            seq($._DEFAULT_BUTTON, $.identifier),
            // kw("DROP-TARGET"),
            // kw("EXPORT"),
            seq($._WIDGET_ID, $.number_literal),
            $._font,
            $._frame_expression,
            // kw("INHERIT-BGCOLOR"),
            // kw("NO-INHERIT-BGCOLOR"),
            // kw("INHERIT-FGCOLOR"),
            // kw("NO-INHERIT-FGCOLOR"),
            // kw("KEEP-TAB-ORDER"),
            $._NO_BOX,
            $._NO_HIDE,
            $._NO_LABELS,
            // kw("USE-DICT-EXPS"),
            $._NO_VALIDATE,
            // kw("NO-AUTO-VALIDATE"),
            // kw("NO-HELP"),
            // kw("NO-UNDERLINE"),
            // kw("OVERLAY"),
            // kw("PAGE-BOTTOM"),
            // kw("PAGE-TOP"),
            // seq(kw("RETAIN"), $.number_literal),
            // kw("SCREEN-IO"),
            $._STREAM_IO,
            seq($._SCROLL, $.number_literal),
            $._SCROLLABLE,
            $._SIDE_LABELS,
            $.size_phrase,
            seq($._STREAM, field("stream", $.identifier)),
            seq($._STREAM_HANDLE, field("stream_handle", $.identifier)),
            // kw("THREE-D"),
            // title phrase
            $._TOP_ONLY,
            $._USE_TEXT,
            // seq(kw("V6FRAME"), optional(choice(kw("USE-REVVIDEO"), kw("USE-UNDERLINE")))),
            seq($._VIEW_AS, $._DIALOG_BOX),
            seq($._WIDTH, $.number_literal),
            seq($._IN_WINDOW, $.identifier),
            // $._option_with_number,
            // $._color_option
          )
        )
      ),

    // Was commented
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

      // Was commented
      // _color_option: ($) =>
      //   choice(
      //     kw("INHERIT-BGCOLOR"),
      //     kw("NO-INHERIT-BGCOLOR"),
      //     kw("INHERIT-FGCOLOR"),
      //     kw("NO-INHERIT-FGCOLOR"),

      //   ),

    stop_after_phrase: ($) => seq($._STOP_AFTER, $._integer_literal),

    do_for_phrase: ($) =>
      seq(
        $._FOR,
        _list($._name, ",")
      ),

    in_frame_phrase: ($) =>
    seq(
        choice($.object_access, $.function_call),
        $._IN,
        $._frame_expression
    ),

    // Was commented
      // widget_phrase: ($) =>
      //   choice(
      //     $._frame_expression,
      //     seq(
      //       optional(alias($._field_keyword, "FIELD")),
      //       $.identifier,
      //       optional(seq($._IN, $._frame_expression))
      //     ),
      //     seq(
      //       $.identifier,
      //       optional(seq($._IN, kw("BROWSE"), $.identifier))
      //     ),
      //     seq(choice(kw("MENU"), kw("SUB-MENU")), $.identifier),
      //     seq(kw("MENU-ITEM"), $.identifier, optional(seq($._IN, kw("MENU"), $.identifier))),
      //     _list($.identifier, ",")
      //   ),

      referencing_phrase: ($) =>
        seq(
          $._NEW, optional($._BUFFER),
          $.identifier,
          $._OLD, optional($._BUFFER),
          $.identifier,
        ),

     // Was commented
      // of_phrase: ($) =>
      //   seq(
      //     $._OF,
      //     $.widget_phrase,
      //   ),

      _on_statement_database_phrase: ($) =>
        prec(2, seq(
          choice(
            $._CREATE,
            $._DELETE,
            $._FIND,
            $._WRITE,
            $._ASSIGN,
          ),
          $._OF,
          _list($._name, ","),
          optional($.referencing_phrase),
          optional($._OVERRIDE),
          choice($.do_block, $._REVERT)
        )),

      // _on_statement_widget_phrase: ($) =>
      //   prec(2, seq(
      //     _list(choice($.identifier, $.constant, $.string_literal), ","),
      //     choice(
      //       seq($._OF, kw("FRAME"), choice($._name, $.constant)),
      //       seq($._OF, _list(choice($._name, $.constant), ","), optional(seq($._IN, kw("FRAME"), choice($._name, $.constant))))
      //     ),
      //     repeat(
      //       seq(
      //         $._OR,
      //         _list(choice($.identifier, $.constant, $.string_literal), ","),
      //         choice(
      //           seq($._OF, kw("FRAME"), choice($._name, $.constant)),
      //           seq($._OF, _list(choice($._name, $.constant), ","), optional(seq($._IN, kw("FRAME"), choice($._name, $.constant))))
      //         )
      //       )
      //     ),
      //     optional(kw("ANYWHERE")),
      //     choice($.do_block, $.run_statement, prec(2, $._statement), kw("REVERT"), seq($._PERSISTENT, $.run_statement))
      //   )),

        // TODO: Refactor (was commented)
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
            $._X,
            $._Y,
            $._ROW,
            $._COLUMN
          ),
          $.number_literal
        ),

      size_phrase: ($) =>
        seq(
          choice(
            $._SIZE,
            $._SIZE_CHARS,
            $._SIZE_PIXELS,
            $._IMAGE_SIZE,
            $._IMAGE_SIZE_CHARS,
            $._IMAGE_SIZE_PIXELS
          ),
          field("width", $.number_literal),
          $._BY,
          field("height", $.number_literal)
        ),

      preselect_phrase: ($) =>
        seq(
          $._PRESELECT,
          _list($._for_phrase, ","),
        ),

      _for_phrase: ($) =>
        seq(
          optional(field("type", choice($._EACH, $._FIRST, $._LAST))),
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
          choice($._LIKE, $._LIKE_SEQUENTIAL),
          $.identifier,
          optional($._VALIDATE),
          optional(seq($._USE_INDEX, $.identifier, optional(seq($._AS, $._PRIMARY))))
        ),

    // OPTIONAL SEQUENCES

    _bgcolor: ($) => seq($._BGCOLOR, $._integer_literal),

    _column_label: ($) => seq($._COLUMN_LABEL, $.string_literal),

    // _context_help_id: ($) => seq(kw("CONTEXT-HELP-ID"), $._integer_literal),

    // _dcolor: ($) => seq(kw("DCOLOR"), $._integer_literal),

    // _decimals: ($) => seq(kw("DECIMALS"), $.number_literal),

    _extent: ($) => seq($._EXTENT, $.number_literal),

    // _fgcolor: ($) => seq(kw("FGCOLOR"), $._integer_literal),

    _font: ($) => seq($._FONT, $._integer_literal),

    _format: ($) => seq($._FORMAT, $.string_literal),

    _frame_expression: ($) => seq($._FRAME, field("frame", choice($.identifier, $.constant))),

    _initial: ($) =>
      seq(
        choice($._INITIAL, $._INIT),
        choice(
          $._literal,
          $.array_literal,
          $.boolean_literal,
          $.null_expression,
          $.identifier,
          $.object_access
        )),

    // // _inner_chars: ($) => seq(kw("INNER-CHARS"), $.number_literal),

    // // _inner_lines: ($) => seq(kw("INNER-LINES"), $.number_literal),

    _label: ($) => seq($._LABEL, _list($.string_literal, ",")),

    _list_items: ($) =>
      seq(
        choice(
          $._LIST_ITEMS,
          $._LIST_ITEM_PAIRS),
        _list(choice($._literal, $._expression), ",")
      ),

    // // _max_chars: ($) => seq(kw("MAX-CHARS"), $.number_literal),

    // // _pfcolor: ($) => seq(kw("PFCOLOR"), $._integer_literal),

    _serialize_name: ($) => seq($._SERIALIZE_NAME, $.string_literal),

    // // _tooltip: ($) => seq(kw("TOOLTIP"), $.string_literal),

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
        // $._define,
        choice(
        $._DEFINE,
        $._DEF,
      ),
        repeat($._tuning),
        $._BUFFER,
        field("name", $.identifier),
        $._FOR,
        optional($._TEMP_TABLE),
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
        // $._define,
        choice(
        $._DEFINE,
        $._DEF,
      ),
        repeat($._tuning),
        $._DATASET,
        field("name", $.identifier),
        $._FOR,
        _list($._name, ","),
        optional($.data_relation),
        $._terminator
      ),

    data_source_definition: ($) =>
      seq(
        // $._define,
        choice(
        $._DEFINE,
        $._DEF,
      ),
        repeat($._tuning),
        $._DATA_SOURCE,
        $.identifier,
        $._FOR,
        repeat($._data_source_definition_option),
        $._terminator
      ),

    _data_source_definition_option: ($) =>
      choice(
        seq($._QUERY, $.identifier),
        _list($._name, ",")
      ),

    enum_definition: ($) =>
      seq(
        // $._define,
        choice(
        $._DEFINE,
        $._DEF,
      ),
        $._ENUM,
        repeat($.enum_member),
        $._terminator
      ),

    event_definition: ($) =>
      seq(
      // $._define,
      choice(
        $._DEFINE,
        $._DEF,
      ),
      repeat($._tuning),
      $._EVENT,
      field("name", $.identifier),
        optional(
            choice(
              seq(optional($._SIGNATURE), $._VOID, alias($.function_parameters, $.parameters)),
              seq(optional($._DELEGATE), optional($._CLASS), $._name),
          )
        ),
        $._terminator
      ),

    // Refactor
    frame_definition: ($) =>
      seq(
        // $._define,
        choice(
        $._DEFINE,
        $._DEF,
      ),
        repeat($._tuning),
        $._FRAME,
        field("name", choice($.identifier, $.constant)),
        repeat(choice($.identifier, $.constant, $.object_access)),
        optional(seq(
          repeat1(choice(
            // $.size_phrase,
            seq($.identifier, $.number_literal, $.identifier, $.number_literal),
          ))


          // $._WITH,
          // repeat1(choice(
          //   $.size_phrase,
          //   seq($._SIZE_PIXELS, $.number_literal, $._BY, $.number_literal),
          //   $._NO_BOX,
          //   seq($._FONT, $.number_literal),
          //   seq($._BGCOLOR, $.number_literal),
          //   seq($._FGCOLOR, $.number_literal),
          //   $._SCROLLABLE,
          //   $._RESIZABLE
          // ))
        )),
        optional(seq($._AT, $._COLUMN, field("column", choice($.number_literal, $.identifier)))),
        optional(seq($._ROW, field("row", choice($.number_literal, $.identifier)))),
        $._terminator
      ),

  //   // image_definition: ($) =>
  //   //   seq(
  //   //     $._define,
  //   //     repeat($._tuning),
  //   //     kw("IMAGE"),
  //   //     field("name", $.identifier),
  //   //     $._image_definition_option,
  //   //     // repeat($.image_tuning),
  //   //     $._terminator
  //   //   ),

  //   // _image_definition_option: ($) =>
  //   //   choice(
  //   //     $.size_phrase,
  //   //     $.image_phrase,
  //   //     seq(kw("LIKE"), $.identifier)
  //   //   ),

    parameter_definition: ($) =>
      seq(
        // $._define,
        choice(
        $._DEFINE,
        $._DEF,
      ),
        optional(
          choice($._INPUT, $._OUTPUT, $._INPUT_OUTPUT, $._RETURN)
        ),
        choice($._PARAMETER, $._PARAM),
        optional($._parameter_definition_option),
        optional($._FOR),
        field("name", $.identifier),
        choice(
          seq($.type_tuning, repeat($.variable_tuning)),
          repeat($.parameter_tuning)
        ),
        $._terminator
      ),

    _table_option: ($) =>
      choice(
        $._TABLE,
        $._TABLE_HANDLE,
        $._DATASET_HANDLE,
        $._DATASET
      ),

    _parameter_definition_option: ($) =>
      choice(
        seq($._BUFFER, field("buffer", $.identifier)),
        $._TABLE,
        $._TABLE_HANDLE,
        $._DATASET,
        $._DATASET_HANDLE
      ),

    browse_definition: ($) =>
      seq(
        // $._define,
        choice(
        $._DEFINE,
        $._DEF,
      ),
        repeat($._tuning),
        $._BROWSE,
        field("name", $.identifier),
        optional(seq($._QUERY, field("query", $.identifier))),
        optional(seq(
          $._DISPLAY,
          repeat1(
            seq(
              $._expression,
              optional(seq($._COLUMN_LABEL, $.string_literal))
            )
          )
        )),
        optional(seq(
          $._WITH,
          repeat1(choice(
            seq($.number_literal, $._DOWN),
            seq($._WIDTH, $.number_literal),
            $._MULTIPLE,
            $._SINGLE
          ))
        )),
        $._terminator
      ),

    rectangle_definition: ($) =>
      seq(
        // $._define,
        choice(
        $._DEFINE,
        $._DEF,
      ),
        repeat($._tuning),
        $._RECTANGLE,
        field("name", $.identifier),
        optional(seq(
          $._SIZE,
          $.number_literal,
          $._BY,
          $.number_literal
        )),
        $._terminator
      ),

    property_definition: ($) =>
      seq(
        // $._define,
        choice(
        $._DEFINE,
        $._DEF,
      ),
        repeat($._tuning),
        $._PROPERTY,
        field("name", $.identifier),
        $.type_tuning,
        repeat($._value_tuning),
        choice(repeat1(choice($.getter, $.setter)), $._terminator)
      ),

    query_definition: ($) =>
      seq(
        // $._define,
        choice(
        $._DEFINE,
        $._DEF,
      ),
        repeat($._tuning),
        $._QUERY,
        field("name", $.identifier),
        $._FOR,
        $.identifier,
        repeat($.query_definition_tuning),
        $._terminator
      ),

    stream_definition: ($) =>
      seq(
        // $._define,
        choice(
        $._DEFINE,
        $._DEF,
      ),
        repeat($._tuning),
        $._STREAM,
        field("name", $.identifier),
        $._terminator
      ),

    temp_table_definition: ($) =>
      seq(
        // $._define,
        choice(
        $._DEFINE,
        $._DEF,
      ),
        repeat($._tuning),
        optional($.serialization_tuning),
        $._TEMP_TABLE,
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
        // $._define,
        choice(
        $._DEFINE,
        $._DEF,
      ),
        repeat($._tuning),
        choice($._VARIABLE, $._VAR),
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
        // $._define,
        choice(
        $._DEFINE,
        $._DEF,
      ),
        repeat($._tuning),
        choice($._WORKFILE, $._WORK_TABLE),
        field("name", $.identifier),
        repeat($.workfile_tuning),
        $._terminator
      ),

    // STATEMENTS

    // Need to add keywords from missing statements
    // abl_statement: ($) =>
    //   seq(
    //     field("statement", $.identifier),
    //     repeat(prec(-1, $._expression)),
    //     $._terminator
    //   ),

    message_statement:($) =>
      seq(
        $._MESSAGE,
        repeat1(
          choice(
            $._message_statement_expression,
            seq(
              $._SKIP,
              optional(seq("(", $._integer_literal, ")"))
            )
          )
        ),
        repeat($._message_tuning),
        optional(seq(
          $._IN,
          $._WINDOW,
          $._name
        )),
        $._terminator
    ),

    // null_statement: ($) => seq($.object_access, $._terminator),

    using_statement: ($) =>
      seq(
        $._USING,
        $._name,
        optional(seq($._FROM, choice($._ASSEMBLY, $._PROPATH))),
        $._terminator
      ),

    interface_statement: ($) =>
      seq(
        $._INTERFACE,
        field("name", choice($.string_literal, $._name)),
        optional($.inherits),
        alias($.interface_body, $.body),
        $._block_terminator
      ),

    class_statement: ($) =>
      seq(
        $._CLASS,
        field("name", choice($.string_literal, $._name)),
        repeat($.class_tuning),
        alias($.class_body, $.body),
        $._block_terminator
      ),

    constructor_statement: ($) =>
      seq(
        $._CONSTRUCTOR,
        repeat(choice($.scope_tuning, $.access_tuning)),
        $.identifier,
        alias($.function_parameters, $.parameters),
        $.body,
        $._block_terminator
      ),

    destructor_statement: ($) =>
      seq(
        $._DESTRUCTOR,
        optional($._PUBLIC),
        $.identifier,
        seq("(", ")"),
        $.body,
        $._block_terminator
      ),

    method_statement: ($) =>
      seq(
        $._METHOD,
        repeat($._tuning),
        alias($._type, $.return_type),
        optional($._extent),
        field("name", $.identifier),
        alias($.function_parameters, $.parameters),
        optional(seq($.body, $._END, optional($._METHOD))),
        $._terminator
      ),

    procedure_statement: ($) =>
      seq(
        $._PROCEDURE,
        $.identifier,
        optional($._PRIVATE),
        optional($.body),
        $._block_terminator
      ),

    case_statement: ($) =>
      seq(
        $._CASE,
        $._expression,
        alias($.case_body, $.body),
        $._block_terminator
      ),

    variable_assignment: ($) => seq($.assignment, optional($._NO_ERROR), $._terminator),

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
          optional(seq(token.immediate(/[iI][nN]/), $._frame_expression)),
        )
      ),

    function_call_statement: ($) => seq($.function_call, $._terminator),

    function_statement: ($) =>
      seq(
        $._FUNCTION,
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
            choice(seq($._IN, $.identifier),
            $._FORWARD
          ),
            $._terminator
          )
      ),

    repeat_statement: ($) =>
      seq(
        optional($.label),
        $._REPEAT,
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
        $._RETURN,
        optional($._return_action),
        $._terminator
      )),

    input_output_statement: ($) =>
      seq(
        choice($._INPUT, $._OUTPUT),
        optional(
          seq(
            choice($._STREAM, $._STREAM_HANDLE),
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
        $._CLOSE,
        seq(
          choice($._FROM, $._TO),
          choice($.string_literal, $.function_call)
        ),
        seq(
          $._THROUGH,
          choice($.identifier, seq($._VALUE, "(", $._expression, ")")),
          repeat(
            choice(
            $.identifier,
            $.string_literal,
            $.number_literal,
            seq($._VALUE, "(", $._expression, ")")
            )
          ),
          optional(seq(">", $.identifier))
        )
      ),

    for_statement: ($) =>
      seq(
        optional($.label),
        $._FOR,
        _list($._for_phrase, ","),
        repeat(choice($._on_phrase, $.frame_phrase, $.while_phrase)),
        $.body,
        $._block_terminator
      ),

    find_statement: ($) =>
      seq(
        $._FIND,
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

    //simplified
    on_statement: ($) =>
      seq(
        $._ON,
        choice(
          seq(field("label", $.identifier), field("function", $.identifier), $._terminator)
        )
      ),

    assign_statement: ($) =>
      seq(
        $._ASSIGN,
        repeat1(choice($.assignment, $.preprocessor_directive)),
        optional($._NO_ERROR),
        $._terminator
      ),

    // catch_statement: ($) =>
    //   seq(
    //     $._CATCH,
    //     field("variable", $.identifier),
    //     kw("AS"),
    //     field(
    //       "type",
    //       seq(optional($._CLASS), $._name)
    //     ),
    //     $.body,
    //     $._block_terminator
    //   ),

    // finally_statement: ($) =>
    //   seq(
    //     $._FINALLY,
    //     $.body,
    //     $._block_terminator
    //   ),

    // accumulate_statement: ($) =>
    //   seq(
    //     kw("ACCUMULATE"),
    //     choice($._name, $._binary_expression),
    //     seq(
    //       "(",
    //       repeat1($.accumulate_aggregate),
    //       ")"
    //     ),
    //     $._terminator
    //   ),

    undo_statement: ($) =>
      seq(
        $._UNDO,
        optional(field("label", $.identifier)),
        ",",
        choice(
          $.action_phrase,
          seq($._THROW, choice($.new_expression, $.identifier))
        ),
        $._terminator
      ),

    // error_scope_statement: ($) =>
    //   seq(
    //     choice(kw("ROUTINE-LEVEL"), kw("BLOCK-LEVEL")),
    //     $.on_error_phrase,
    //     $._terminator
    //   ),

    // on_statement: ($) =>
    //   seq(
    //     $._ON,
    //     choice(
    //       $._on_statement_widget_phrase,
    //       $._on_statement_database_phrase,
    //       seq(field("label", $.identifier), field("function", $.identifier), $._terminator),
    //       // seq(alias("\"WEB-NOTIFY\"", $.string_literal), kw("ANYWHERE"), $._statement_body)
    //     )
    //   ),

  //    prompt_for_statement: ($) =>
  //     seq(
  //       kw("PROMPT-FOR"),
  //       $._name,
  //       optional($._frame_expression),
  //       choice(seq(kw("EDITING"), $.body, $._block_terminator), $._terminator)
  //     ),

    // var_statement: ($) =>
    //   seq(
    //     $._VAR,
    //     optional(
    //       choice($.scope_tuning, $.access_tuning, $.serialization_tuning)
    //     ),
    //     alias(choice($._type, $.string_literal), $.type_tuning),
    //     optional(field("size", $.array_literal)),
    //     _list($.variable, ","),
    //     $._terminator
    //   ),

  //   release_statement: ($) =>
  //     seq(
  //       kw("RELEASE"),
  //       $.identifier,
  //       optional($._NO_ERROR),
  //       $._terminator
  //     ),

  //   run_statement: ($) =>
  //     seq(
  //       kw("RUN"),
  //       field(
  //         "procedure",
  //         choice($._name, $.function_call, $.file_name, $.string_literal)
  //       ),
  //       optional($.function_call_argument),
  //       repeat($.run_tuning),
  //       optional(alias($.function_arguments, $.arguments)),
  //       optional($._NO_ERROR),
  //       $._terminator
  //     ),

    enum_statement: ($) =>
      seq(
        $._ENUM,
        field("name", $.identifier),
        optional($._FLAGS),
        alias($.enum_body, $.body),
        $._block_terminator
      ),

    do_block: ($) =>
      seq(
        optional($.label),
        $._DO,
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
        $._TRANSACTION
      ),

    if_statement: ($) =>
      seq(
        $._if_phrase,
        $._statement_body,
        repeat($.else_statement)
      ),

    _if_phrase: ($) =>
      seq(
        $._IF,
        field("condition", $._expression),
        $._THEN
      ),

    else_statement: ($) =>
      prec(
        1,
        seq(
          $._ELSE,
          optional($._if_phrase),
          $._statement_body
        )
      ),

    update_statement: ($) => seq(
      $._UPDATE,
      optional($._UNLESS_HIDDEN),
      repeat($.update_tuning),
      optional($.go_on_clause),
      optional($.frame_phrase),
      optional($._NO_ERROR),
      $._terminator
    ),

  go_on_clause: ($) =>
    seq(
      $._GO_ON,
      "(",
      _list($.identifier, ","),
      ")"
    ),

  // editing_phrase: ($) =>
  //   seq(
  //     optional(seq($.identifier, ":")),
  //     kw("EDITING"),
  //     ":",
  //     repeat(choice($._statement, $._definition)),
  //     $._END
  //   ),

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
          seq("-", prec.left($._unary_minus_expression))
        ),
        prec.left(
          PREC.LOGICAL,
          seq($._NOT, prec.left(PREC.LOGICAL, $._expression))
        )
      ),

    ambiguous_expression: ($) => seq($._AMBIGUOUS, $._name),

    temp_table_expression: ($) =>
      seq($._TEMP_TABLE, field("table", choice($.identifier, $.object_access))),

    query_expression: ($) =>
      seq($._QUERY, field("query", choice($.identifier, $.object_access))),

    stream_expression: ($) =>
      seq($._STREAM, field("stream", choice($.identifier, $.object_access))),

    buffer_expression: ($) =>
      seq($._BUFFER, field("buffer", choice($.identifier, $.object_access))),

    current_changed_expression: ($) => seq($._CURRENT_CHANGED, $._name),

    locked_expression: ($) => seq($._LOCKED, $._name),

  // TODO: Refactor
    // dataset_expression: ($) => prec(-1, seq(token(seq(/[Dd][Aa][Tt][Aa][Ss][Ee][Tt]/, /\s/)), $._name)),

    when_expression: ($) => seq($._WHEN, $._expression),


    input_expression: ($) =>
      seq(
        $._INPUT,
        optional($._frame_expression),
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
        $._CAN_FIND,
        "(",
        $._can_find_body,
        ")"
      ),

    _can_find_body: ($) =>
      seq(
        optional(choice($._FIRST, $._LAST)),
        field("table", $._name),
        optional(field("constant", $._literal)),
        repeat(choice($.query_tuning, $.of, $.where_clause)),
      ),

    accumulate_expression: ($) =>
      seq($._ACCUM, $.accumulate_aggregate, $._expression),

    available_expression: ($) =>
      seq(
        choice($._AVAIL, $._AVAILABLE),
        choice($.identifier, $.parenthesized_expression),
      ),

    new_expression: ($) =>
      prec.right(
        seq(
          choice($._NEW, $._DYNAMIC_NEW),
          $._name,
          alias($.function_arguments, $.arguments),
          optional($._NO_ERROR)
        )
      ),

    ternary_expression: ($) =>
      prec.right(
        seq(
          $._IF,
          field("condition", $._expression),
          $._THEN,
          field("then", $._expression),
          $._ELSE,
          field("else", $._expression)
        )
      ),

    _return_value_expression: ($) =>
      choice(
        $.string_literal,
        $.number_literal,
        $.boolean_literal,
        $.null_expression,
  //       $.dataset_expression,
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

    // _statement: ($) =>
    //   choice(
    //     $.on_statement,
    //     // $.abl_statement
    //   ),

 _expression: ($) =>
      choice(
        $.parenthesized_expression,
        $.unary_expression,
        $.null_expression,
        $._binary_expression,
        $.ternary_expression,
        $.available_expression,
        // $.accumulate_expression,
        $.ambiguous_expression,
        $.temp_table_expression,
        $.current_changed_expression,
        $.locked_expression,
//         $.dataset_expression,
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
        // $.var_statement,
        $.message_statement,
//         $.null_statement,
        // $.procedure_statement,
        // $.function_statement,
        // $.function_call_statement,
        $.return_statement,
        $.if_statement,
//         $.for_statement,
//         $.repeat_statement,
//         $.find_statement,
//         $.case_statement,
//         $.input_output_statement,
//         $.assign_statement,
//         $.catch_statement,
//         $.finally_statement,
//         $.accumulate_statement,
        $.undo_statement,
//         $.error_scope_statement,
//         $.using_statement,
        $.on_statement,
//         $.prompt_for_statement,
//         $.release_statement,
//         $.run_statement,
        $.enum_statement,
        $.update_statement,
//         $.abl_statement,

//         $.variable_assignment,
//         $.preprocessor_directive,
//         $.include,
//         $.annotation //TODO: Check should it be in supertype
      ),





    // KEYWORDS

    _ABSTRACT:                       $ => /[aA][bB][sS][tT][rR][aA][cC][tT]/,
    _ABLFORMATTEREXCLUDEEND:         $ => /[aA][bB][lL][fF][oO][rR][mM][aA][tT][tT][eE][rR][eE][xX][cC][lL][uU][dD][eE][eE][nN][dD]/,
    _ABLFORMATTEREXCLUDESTART:       $ => /[aA][bB][lL][fF][oO][rR][mM][aA][tT][tT][eE][rR][eE][xX][cC][lL][uU][dD][eE][sS][tT][aA][rR][tT]/,

    _ACCUM:                          $ => /[aA][cC][cC][uU][mM]/,

    _AFTER:                          $ => /[aA][fF][tT][eE][rR]/,
    _AFTERALL:                       $ => /[aA][fF][tT][eE][rR][aA][lL][lL]/,
    _AFTEREACH:                      $ => /[aA][fF][tT][eE][rR][eE][aA][cC][hH]/,

    _AMBIGUOUS:                      $ => /[aA][mM][bB][iI][gG][uU][oO][uU][sS]/,

    _AND:                            $ => /[aA][nN][dD]/,

    _APPEND:                         $ => /[aA][pP][pP][eE][nN][dD]/,
    _AS:                             $ => /[aA][sS]/,
    _ASSEMBLY:                       $ => /[aA][sS][sS][eE][mM][bB][lL][yY]/,
    _ASSIGN:                         $ => /[aA][sS][sS][iI][gG][nN]/,
    _ASC:                            $ => /[aA][sS][cC]/,
    _ASCENDING:                      $ => /[aA][sS][cC][eE][nN][dD][iI][nN][gG]/,
    _AT:                             $ => /[aA][tT]/,
    _AUTO_COMPLETION:                $ => /[aA][uU][tT][oO]-[cC][oO][mM][pP][lL][eE][tT][iI][oO][nN]/,
    _AUTO_ENDKEY:                    $ => /[aA][uU][tT][oO]-[eE][nN][dD][kK][eE][yY]/,
    _AUTO_GO:                        $ => /[aA][uU][tT][oO]-[gG][oO]/,
    _AUTO_RETURN:                    $ => /[aA][uU][tT][oO]-[rR][eE][tT][uU][rR][nN]/,
    _AVAIL:                          $ => /[aA][vV][aA][iI][lL]/,
    _AVAILABLE:                      $ => /[aA][vV][aA][iI][lL][aA][bB][lL][eE]/,

    _ASYNCHRONOUS:                   $ => /[aA][sS][yY][nN][cC][hH][rR][oO][nN][oO][uU][sS]/,

    _AVERAGE:                        $ => /[aA][vV][eE][rR][aA][gG][eE]/,

    _BEFORE:                         $ => /[bB][eE][fF][oO][rR][eE]/,
    _BEFOREALL:                      $ => /[bB][eE][fF][oO][rR][eE][aA][lL][lL]/,
    _BEFOREEACH:                     $ => /[bB][eE][fF][oO][rR][eE][eE][aA][cC][hH]/,

    _BEGINS:                         $ => /[bB][eE][gG][iI][nN][sS]/,
    _BEFORE_TABLE:                   $ => /[bB][eE][fF][oO][rR][eE]-[tT][aA][bB][lL][eE]/,
    _BINARY:                         $ => /[bB][iI][nN][aA][rR][yY]/,
    _BLINK:                          $ => /[bB][lL][iI][nN][kK]-/,
    _BOTTOM:                         $ => /[bB][oO][tT][tT][oO][mM]/,
    _BREAK:                          $ => /[bB][rR][eE][aA][kK]/,
    _BRIGHT:                         $ => /[bB][rR][iI][gG][hH][tT]-/,
    _BROWSE:                         $ => /[bB][rR][oO][wW][sS][eE]/,
    _BUFFER_CHARS:                   $ => /[bB][uU][fF][fF][eE][rR]-[cC][hH][aA][rR][sS]/,
    _BUFFER_LINES:                   $ => /[bB][uU][fF][fF][eE][rR]-[lL][iI][nN][eE][sS]/,
    _BUTTONS:                        $ => /[bB][uU][tT][tT][oO][nN][sS]/,
    _BY:                             $ => /[bB][yY]/,

    _BIND:                           $ => /[bB][iI][nN][dD]/,
    _BGCOLOR:                         $ => /[bB][gG][cC][oO][lL][oO][rR]/,

    _BUFFER:                         $ => /[bB][uU][fF][fF][eE][rR]/,

    _BY_REFERENCE:                   $ => /[bB][yY]-[rR][eE][fF][eE][rR][eE][nN][cC][eE]/,
    _BY_VALUE:                       $ => /[bB][yY]-[vV][aA][lL][uU][eE]/,

    _C:                              $ => /[cC]/,
    _CACHE:                          $ => /[cC][aA][cC][hH][eE]/,
    _CAN_FIND:                       $ => /[cC][aA][nN]-[fF][iI][nN][dD]/,
    _CANCEL:                         $ => /[cC][aA][nN][cC][eE][lL]/,
    _CANCEL_BUTTON:                  $ => /[cC][aA][nN][cC][eE][lL]-[bB][uU][tT][tT][oO][nN]/,
    _CASE_SENSITIVE:                 $ => /[cC][aA][sS][eE]-[sS][eE][nN][sS][iI][tT][iI][vV][eE]/,
    _CENTERED:                       $ => /[cC][eE][nN][tT][eE][rR][eE][dD]/,
    _CLOSE:                          $ => /[cC][lL][oO][sS][eE]/,
    _COLLATE:                        $ => /[cC][oO][lL][lL][aA][tT][eE]/,
    _COLOR:                          $ => /[cC][oO][lL][oO][rR]/,
    _COLUMNS:                        $ => /[cC][oO][lL][uU][mM][nN][sS]/,
    _COLUMN_LABEL:                   $ => /[cC][oO][lL][uU][mM][nN]-[lL][aA][bB][eE][lL]/,
    _COMBO_BOX:                      $ => /[cC][oO][mM][bB][oO]-[bB][oO][xX]/,
    _CONTEXT_HELP:                   $ => /[cC][oO][nN][tT][eE][xX][tT]-[hH][eE][lL][pP]/,
    _CONVERT:                        $ => /[cC][oO][nN][vV][eE][rR][tT]/,
    _CONVERT_3D_COLORS:              $ => /[cC][oO][nN][vV][eE][rR][tT]-3[dD]-[cC][oO][lL][oO][rR][sS]/,
    _CREATE:                         $ => /[cC][rR][eE][aA][tT][eE]/,
    _CURRENT:                        $ => /[cC][uU][rR][rR][eE][nN][tT]/,

    _CASE:                           $ => /[cC][aA][sS][eE]/,
    _CASE_SENSITIVE:                 $ => /[cC][aA][sS][eE]-[sS][eE][nN][sS][iI][tT][iI][vV][eE]/,

    _CATCH:                          $ => /[cC][aA][tT][cC][hH]/,

    _CHAR:                           $ => /[cC][hH][aA][rR]/,
    _CHARACTER:                      $ => /[cC][hH][aA][rR][aA][cC][tT][eE][rR]/,

    _CLASS:                          $ => /[cC][lL][aA][sS][sS]/,

    _COLUMN:                         $ => /[cC][oO][lL][uU][mM][nN]/,
    _COM_HANDLE:                     $ => /[cC][oO][mM]-[hH][aA][nN][dD][lL][eE]/,

    _CONSTRUCTOR:                    $ => /[cC][oO][nN][sS][tT][rR][uU][cC][tT][oO][rR]/,

    _CONTAINS:                       $ => /[cC][oO][nN][tT][aA][iI][nN][sS]/,

    _COUNT:                          $ => /[cC][oO][uU][nN][tT]/,

    _CURRENT_CHANGED:                $ => /[cC][uU][rR][rR][eE][nN][tT]-[cC][hH][aA][nN][gG][eE][dD]/,

    _DATE:                           $ => /[dD][aA][tT][eE]/,
    _DATETIME:                       $ => /[dD][aA][tT][eE][tT][iI][mM][eE]/,
    _DATETIME_TZ:                    $ => /[dD][aA][tT][eE][tT][iI][mM][eE]-[tT][zZ]/,

    _DECIMAL:                        $ => /[dD][eE][cC][iI][mM][aA][lL]/,

    _DEFINE:                         $ => /[dD][eE][fF][iI][nN][eE]/,
    _DEF:                            $ => /[dD][eE][fF]/,
    _DECIMALS:                       $ => /[dD][eE][cC][iI][mM][aA][lL][sS]/,
    _DELETE:                         $ => /[dD][eE][lL][eE][tT][eE]/,
    _DESCENDING:                     $ => /[dD][eE][sS][cC][eE][nN][dD][iI][nN][gG]/,
    _DESC:                           $ => /[dD][eE][sS][cC]/,
    _DATA_RELATION:                  $ => /[dD][aA][tT][aA]-[rR][eE][lL][aA][tT][iI][oO][nN]/,
    _DATA_SOURCE:                    $ => /[dD][aA][tT][aA]-[sS][oO][uU][rR][cC][eE]/,
    _DATASET:                        $ => /[dD][aA][tT][aA][sS][eE][tT]/,
    _DATASET_HANDLE:                 $ => /[dD][aA][tT][aA][sS][eE][tT]-[hH][aA][nN][dD][lL][eE]/,
    _DEFAULT:                        $ => /[dD][eE][fF][aA][uU][lL][tT]/,
    _DEFAULT_BUTTON:                 $ => /[dD][eE][fF][aA][uU][lL][tT]-[bB][uU][tT][tT][oO][nN]/,
    _DELEGATE:                       $ => /[dD][eE][lL][eE][gG][aA][tT][eE]/,
    _DIALOG_BOX:                     $ => /[dD][iI][aA][lL][oO][gG]-[bB][oO][xX]/,
    _DISPLAY:                        $ => /[dD][iI][sS][pP][lL][aA][yY]/,
    _DO:                             $ => /[dD][oO]/,
    _DOWN:                           $ => /[dD][oO][wW][nN]/,
    _DROP_DOWN:                      $ => /[dD][rR][oO][pP]-[dD][oO][wW][nN]/,
    _DROP_DOWN_LIST:                 $ => /[dD][rR][oO][pP]-[dD][oO][wW][nN]-[lL][iI][sS][tT]/,
    _DROP_TARGET:                    $ => /[dD][rR][oO][pP]-[tT][aA][rR][gG][eE][tT]/,
    _DYNAMIC_NEW:                    $ => /[dD][yY][nN][aA][mM][iI][cC]-[nN][eE][wW]/,

    _DESTRUCTOR:                     $ => /[dD][eE][sS][tT][rR][uU][cC][tT][oO][rR]/,

    _ENUM:                           $ => /[eE][nN][uU][mM]/,
    _END:                            $ => /[eE][nN][dD]/,
    _EACH:                           $ => /[eE][aA][cC][hH]/,
    _ECHO:                           $ => /[eE][cC][hH][oO]/,
    _ELSE:                           $ => /[eE][lL][sS][eE]/,
    _ENDKEY:                         $ => /[eE][nN][dD][kK][eE][yY]/,
    _ERROR:                          $ => /[eE][rR][rR][oO][rR]/,
    _EVENT:                          $ => /[eE][vV][eE][nN][tT]/,
    _EXCEPT:                         $ => /[eE][xX][cC][eE][pP][tT]/,
    _EXPAND:                         $ => /[eE][xX][pP][aA][nN][dD]/,
    _EXTENT:                         $ => /[eE][xX][tT][eE][nN][tT]/,

    _EQ:                             $ => /[eE][qQ]/,

    _EVENT_PROCEDURE:                $ => /[eE][vV][eE][nN][tT]-[pP][rR][oO][cC][eE][dD][uU][rR][eE]/,

    _EXCLUSIVE_LOCK:                 $ => /[eE][xX][cC][lL][uU][sS][iI][vV][eE]-[lL][oO][cC][kK]/,

    _FALSE:                          $ => /[fF][aA][lL][sS][eE]/,
    _FGCOLOR:                        $ => /[fF][gG][cC][oO][lL][oO][rR]/,
    _FIELD:                          $ => /[fF][iI][eE][lL][dD]/,
    _FIELDS:                         $ => /[fF][iI][eE][lL][dD][sS]/,
    _FILE:                           $ => /[fF][iI][lL][eE]/,
    _FILL_IN:                        $ => /[fF][iI][lL][lL]-[iI][nN]/,
    _FIND:                           $ => /[fF][iI][nN][dD]/,
    _FIRST:                          $ => /[fF][iI][rR][sS][tT]/,
    _FLAGS:                          $ => /[fF][lL][aA][gG][sS]/,
    _FLAT_BUTTON:                    $ => /[fF][lL][aA][tT]-[bB][uU][tT][tT][oO][nN]/,
    _FONT:                           $ => /[fF][oO][nN][tT]/,
    _FOREACH:                        $ => /[fF][oO][rR][eE][aA][cC][hH]/,
    _FORMAT:                         $ => /[fF][oO][rR][mM][aA][tT]/,
    _FORWARD:                        $ => /[fF][oO][rR][wW][aA][rR][dD]/,
    _FRAME:                          $ => /[fF][rR][aA][mM][eE]/,
    _FREQUENCY:                      $ => /[fF][rR][eE][qQ][uU][eE][nN][cC][yY]/,
    _FROM:                           $ => /[fF][rR][oO][mM]/,

    _FINAL:                          $ => /[fF][iI][nN][aA][lL]/,
    _FINALLY:                        $ => /[fF][iI][nN][aA][lL][lL][yY]/,

    _FOR:                             $ => /[fF][oO][rR]/,

    _FUNCTION:                       $ => /[fF][uU][nN][cC][tT][iI][oO][nN]/,

    _GE:                             $ => /[gG][eE]/,
    _GET:                            $ => /[gG][eE][tT]/,
    _GLOBAL:                         $ => /[gG][lL][oO][bB][aA][lL]/,
    _GO_ON:                          $ => /[gG][oO]-[oO][nN]/,
    _GT:                             $ => /[gG][tT]/,

    _HANDLE:                         $ => /[hH][aA][nN][dD][lL][eE]/,
    _HELP:                           $ => /[hH][eE][lL][pP]/,
    _HORIZONTAL:                     $ => /[hH][oO][rR][iI][zZ][oO][nN][tT][aA][lL]/,

    _IF:                             $ => /[iI][fF]/,

    _IMAGE_SIZE:                     $ => /[iI][mM][aA][gG][eE]-[sS][iI][zZ][eE]/,
    _IMAGE_SIZE_CHARS:               $ => /[iI][mM][aA][gG][eE]-[sS][iI][zZ][eE]-[cC][hH][aA][rR][sS]/,
    _IMAGE_SIZE_PIXELS:              $ => /[iI][mM][aA][gG][eE]-[sS][iI][zZ][eE]-[pP][iI][xX][eE][lL][sS]/,
    _IMPLEMENTS:                     $ => /[iI][mM][pP][lL][eE][mM][eE][nN][tT][sS]/,
    _INDEX:                          $ => /[iI][nN][dD][eE][xX]/,
    _INIT:                           $ => /[iI][nN][iI][tT]/,
    _INITIAL:                        $ => /[iI][nN][iI][tT][iI][aA][lL]/,
    _INFO:                           $ => /[iI][nN][fF][oO]/,
    _INFORMATION:                    $ => /[iI][nN][fF][oO][rR][mM][aA][tT][iI][oO][nN]/,
    _INHERITS:                       $ => /[iI][nN][hH][eE][rR][iI][tT][sS]/,
    _INPUT:                          $ => /[iI][nN][pP][uU][tT]/,
    _INPUT_OUTPUT:                   $ => /[iI][nN][pP][uU][tT]-[oO][uU][tT][pP][uU][tT]/,
    _IS:                             $ => /[iI][sS]/,

    _IGNORE:                         $ => /[iI][gG][nN][oO][rR][eE]/,

    _IN:                             $ => /[iI][nN]/,
    _IN_WINDOW:                      $ => /[iI][nN]-[wW][iI][nN][dD][oO][wW]/,

    _INTEGER:                        $ => /[iI][nN][tT][eE][gG][eE][rR]/,
    _INT:                            $ => /[iI][nN][tT]/,
    _INT64:                          $ => /[iI][nN][tT]64/,

    _INTERFACE:                      $ => /[iI][nN][tT][eE][rR][fF][aA][cC][eE]/,

    _KEEP_MESSAGES:                 $ => /[kK][eE][eE][pP]-[mM][eE][sS][sS][aA][gG][eE][sS]/,

    _L:                              $ => /[lL]/,

    _LE:                             $ => /[lL][eE]/,

    _LOCKED:                         $ => /[lL][oO][cC][kK][eE][dD]/,

    _LOGICAL:                        $ => /[lL][oO][gG][iI][cC][aA][lL]/,

    _LONGCHAR:                       $ => /[lL][oO][nN][gG][cC][hH][aA][rR]/,

    _LT:                             $ => /[lL][tT]/,
    _LABEL:                          $ => /[lL][aA][bB][eE][lL]/,
    _LANDSCAPE:                      $ => /[lL][aA][nN][dD][sS][cC][aA][pP][eE]/,
    _LARGE:                          $ => /[lL][aA][rR][gG][eE]/,
    _LARGE_TO_SMALL:                 $ => /[lL][aA][rR][gG][eE]-[tT][oO]-[sS][mM][aA][lL][lL]/,
    _LAST:                           $ => /[lL][aA][sS][tT]/,
    _LEAVE:                          $ => /[lL][eE][aA][vV][eE]/,
    _LEFT:                           $ => /[lL][eE][fF][tT]/,
    _LIKE:                           $ => /[lL][iI][kK][eE]/,
    _LIKE_SEQUENTIAL:                $ => /[lL][iI][kK][eE]-[sS][eE][qQ][uU][eE][nN][tT][iI][aA][lL]/,
    _LIST_BOX:                       $ => /[lL][iI][sS][tT]-[bB][oO][xX]/,
    _LIST_ITEMS:                     $ => /[lL][iI][sS][tT]-[iI][tT][eE][mM][sS]/,
    _LIST_ITEM_PAIRS:                $ => /[lL][iI][sS][tT]-[iI][tT][eE][mM]-[pP][aA][iI][rR][sS]/,
    _LOB_DIR:                        $ => /[lL][oO][bB]-[dD][iI][rR]/,

    _MATCHES:                        $ => /[mM][aA][tT][cC][hH][eE][sS]/,

    _MAXIMUM:                        $ => /[mM][aA][xX][iI][mM][uU][mM]/,
    _MAP:                            $ => /[mM][aA][pP]/,
    _MAX_VALUE:                      $ => /[mM][aA][xX]-[vV][aA][lL][uU][eE]/,
    _MESSAGE:                        $ => /[mM][eE][sS][sS][aA][gG][eE]/,
    _MESSAGES:                       $ => /[mM][eE][sS][sS][aA][gG][eE][sS]/,
    _METHOD:                         $ => /[mM][eE][tT][hH][oO][dD]/,
    _MIN_VALUE:                      $ => /[mM][iI][nN]-[vV][aA][lL][uU][eE]/,
    _MINIMUM:                        $ => /[mM][iI][nN][iI][mM][uU][mM]/,

    _MOUSE_POINTER:                  $ => /[mM][oO][uU][sS][eE]-[pP][oO][iI][nN][tT][eE][rR]/,
    _MULTIPLE:                       $ => /[mM][uU][lL][tT][iI][pP][lL][eE]/,

    _MEMPTR:                         $ => /[mM][eE][mM][pP][tT][rR]/,

    _MINIMUM:                        $ => /[mM][iI][nN][iI][mM][uU][mM]/,

    _MOD:                            $ => /[mM][oO][dD]/,
    _MODULO:                         $ => /[mM][oO][dD][uU][lL][oO]/,

    _NE:                             $ => /[nN][eE]/,
    _NEW:                            $ => /[nN][eE][wW]/,
    _NEXT:                            $ => /[nN][eE][xX][tT]/,

    _NO:                             $ => /[nN][oO]/,

    _NOT:                            $ => /[nN][oO][tT]/,
    _NATIVE:                         $ => /[nN][aA][tT][iI][vV][eE]/,
    _NAMESPACE_PREFIX:               $ => /[nN][aA][mM][eE][sS][pP][aA][cC][eE]-[pP][rR][eE][fF][iI][xX]/,
    _NAMESPACE_URI:                  $ => /[nN][aA][mM][eE][sS][pP][aA][cC][eE]-[uU][rR][iI]/,
    _NO_CURRENT_VALUE:               $ => /[nN][oO]-[cC][uU][rR][rR][eE][nN][tT]-[vV][aA][lL][uU][eE]/,
    _NO_BOX:                         $ => /[nN][oO]-[bB][oO][xX]/,
    _NO_CONVERT:                     $ => /[nN][oO]-[cC][oO][nN][vV][eE][rR][tT]/,
    _NO_DRAG:                        $ => /[nN][oO]-[dD][rR][aA][gG]/,
    _NO_ECHO:                        $ => /[nN][oO]-[eE][cC][hH][oO]/,
    _NO_HELP:                        $ => /[nN][oO]-[hH][eE][lL][pP]/,
    _NO_HIDE:                        $ => /[nN][oO]-[hH][iI][dD][eE]/,
    _NO_LABELS:                      $ => /[nN][oO]-[lL][aA][bB][eE][lL][sS]/,
    _NO_MAP:                         $ => /[nN][oO]-[mM][aA][pP]/,
    _NO_UNDO:                        $ => /[nN][oO]-[uU][nN][dD][oO]/,
    _NO_VALIDATE:                    $ => /[nN][oO]-[vV][aA][lL][iI][dD][aA][tT][eE]/,
    _NON_SERIALIZABLE:               $ => /[nN][oO][nN]-[sS][eE][rR][iI][aA][lL][iI][zZ][aA][bB][lL][eE]/,
    _NORMAL:                         $ => /[nN][oO][rR][mM][aA][lL]/,
    _NOWHERE:                        $ => /[nN][oO][wW][hH][eE][rR][eE]/,
    _NUM_COPIES:                     $ => /[nN][uU][mM]-[cC][oO][pP][iI][eE][sS]/,

    _NO_APPLY:                       $ => /[nN][oO]-[aA][pP][pP][lL][yY]/,
    _NO_ERROR:                       $ => /[nN][oO]-[eE][rR][rR][oO][rR]/,
    _NO_LOCK:                        $ => /[nN][oO]-[lL][oO][cC][kK]/,
    _NO_PREFETCH:                    $ => /[nN][oO]-[pP][rR][eE][fF][eE][tT][cC][hH]/,
    _NO_WAIT:                        $ => /[nN][oO]-[wW][aA][iI][tT]/,

    _OF:                             $ => /[oO][fF]/,
    _OK:                             $ => /[oO][kK]/,
    _OK_CANCEL:                      $ => /[oO][kK]-[cC][aA][nN][cC][eE][lL]/,
    _OK_HELP:                        $ => /[oO][kK]-[hH][eE][lL][pP]/,
    _OLD:                            $ => /[oO][lL][dD]/,
    _OTHERWISE:                      $ => /[oO][tT][hH][eE][rR][wW][iI][sS][eE]/,

    _ON:                             $ => /[oO][nN]/,

    _OR:                             $ => /[oO][rR]/,
    _OUTPUT:                         $ => /[oO][uU][tT][pP][uU][tT]/,

    _OVERRIDE:                       $ => /[oO][vV][eE][rR][rR][iI][dD][eE]/,

    _PACKAGE_PRIVATE:                $ => /[pP][aA][cC][kK][aA][gG][eE]-[pP][rR][iI][vV][aA][tT][eE]/,
    _PACKAGE_PROTECTED:              $ => /[pP][aA][cC][kK][aA][gG][eE]-[pP][rR][oO][tT][eE][cC][tT][eE][dD]/,
    _PARAM:                          $ => /[pP][aA][rR][aA][mM]/,
    _PARAMETER:                      $ => /[pP][aA][rR][aA][mM][eE][tT][eE][rR]/,
    _PAUSE:                          $ => /[pP][aA][uU][sS][eE]/,

    _PERSISTENT:                     $ => /[pP][eE][rR][sS][iI][sS][tT][eE][nN][tT]/,
    _PORTRAIT:                       $ => /[pP][oO][rR][tT][rR][aA][iI][tT]/,

    _PRIMARY:                        $ => /[pP][rR][iI][mM][aA][rR][yY]/,
    _PREV:                           $ => /[pP][rR][eE][vV]/,
    _PRESELECT:                      $ => /[pP][rR][eE][sS][eE][lL][eE][cC][tT]/,
    _PROPATH:                        $ => /[pP][rR][oO][pP][aA][tT][hH]/,
    _PROPERTY:                       $ => /[pP][rR][oO][pP][eE][rR][tT][yY]/,
    _PAGED:                          $ => /[pP][aA][gG][eE][dD]/,

    _PRIVATE:                        $ => /[pP][rR][iI][vV][aA][tT][eE]/,
    _PROCEDURE:                      $ => /[pP][rR][oO][cC][eE][dD][uU][rR][eE]/,
    _PROTECTED:                      $ => /[pP][rR][oO][tT][eE][cC][tT][eE][dD]/,
    _PUBLIC:                         $ => /[pP][uU][bB][lL][iI][cC]/,

    _R:                              $ => /[rR]/,
    _RAW:                            $ => /[rR][aA][wW]/,

    _RECID:                          $ => /[rR][eE][cC][iI][dD]/,

    _ROW:                            $ => /[rR][oO][wW]/,
    _ROWID:                          $ => /[rR][oO][wW][iI][dD]/,
    _RADIO_BUTTONS:                  $ => /[rR][aA][dD][iI][oO]-[bB][uU][tT][tT][oO][nN][sS]/,
    _RADIO_SET:                      $ => /[rR][aA][dD][iI][oO]-[sS][eE][tT]/,
    _RCODE_INFORMATION:              $ => /[rR][cC][oO][dD][eE]-[iI][nN][fF][oO][rR][mM][aA][tT][iI][oO][nN]/,
    _RECTANGLE:                      $ => /[rR][eE][cC][tT][aA][nN][gG][lL][eE]/,
    _REFERENCE_ONLY:                 $ => /[rR][eE][fF][eE][rR][eE][nN][cC][eE]-[oO][nN][lL][yY]/,
    _RELATION_FIELDS:                $ => /[rR][eE][lL][aA][tT][iI][oO][nN]-[fF][iI][eE][lL][dD][sS]/,
    _REPEAT:                         $ => /[rR][eE][pP][eE][aA][tT]/,
    _RESIZABLE:                      $ => /[rR][eE][sS][iI][zZ][aA][bB][lL][eE]/,
    _RETAIN:                         $ => /[rR][eE][tT][aA][iI][nN]/,
    _RETAIN_SHAPE:                   $ => /[rR][eE][tT][aA][iI][nN]-[sS][hH][aA][pP][eE]/,
    _RETRY:                          $ => /[rR][eE][tT][rR][yY]/,
    _RETURNS:                        $ => /[rR][eE][tT][uU][rR][nN][sS]/,
    _RETURN:                         $ => /[rR][eE][tT][uU][rR][nN]/,
    _REVERT:                         $ => /[rR][eE][vV][eE][rR][tT]/,
    _RIGHT:                          $ => /[rR][iI][gG][hH][tT]/,
    _RVV:                            $ => /[rR][vV][vV]-/,

    _QUERY:                          $ => /[qQ][uU][eE][rR][yY]/,
    _QUESTION:                       $ => /[qQ][uU][eE][sS][tT][iI][oO][nN]/,
    _QUIT:                           $ => /[qQ][uU][iI][tT]/,

    _SERIALIZABLE:                   $ => /[sS][eE][rR][iI][aA][lL][iI][zZ][aA][bB][lL][eE]/,
    _SERIALIZE_HIDDEN:              $ => /[sS][eE][rR][iI][aA][lL][iI][zZ][eE]-[hH][iI][dD][dD][eE][nN]/,

    _SET:                            $ => /[sS][eE][tT]/,
    _SETUP:                          $ => /[sS][eE][tT][uU][pP]/,
    _SCROLL:                         $ => /[sS][cC][rR][oO][lL][lL]/,
    _SCROLLABLE:                     $ => /[sS][cC][rR][oO][lL][lL][aA][bB][lL][eE]/,
    _SCROLLBAR_HORIZONTAL:           $ => /[sS][cC][rR][oO][lL][lL][bB][aA][rR]-[hH][oO][rR][iI][zZ][oO][nN][tT][aA][lL]/,
    _SCROLLBAR_VERTICAL:             $ => /[sS][cC][rR][oO][lL][lL][bB][aA][rR]-[vV][eE][rR][tT][iI][cC][aA][lL]/,
    _SCROLLING:                      $ => /[sS][cC][rR][oO][lL][lL][iI][nN][gG]/,
    _SELECTION_LIST:                 $ => /[sS][eE][lL][eE][cC][tT][iI][oO][nN]-[lL][iI][sS][tT]/,
    _SERIALIZE_NAME:                 $ => /[sS][eE][rR][iI][aA][lL][iI][zZ][eE]-[nN][aA][mM][eE]/,
    _SERVER:                         $ => /[sS][eE][rR][vV][eE][rR]/,
    _SIDE_LABELS:                    $ => /[sS][iI][dD][eE]-[lL][aA][bB][eE][lL][sS]/,
    _SIGNATURE:                      $ => /[sS][iI][gG][nN][aA][tT][uU][rR][eE]/,
    _SIMPLE:                         $ => /[sS][iI][mM][pP][lL][eE]/,
    _SIZE:                           $ => /[sS][iI][zZ][eE]/,
    _SIZE_CHARS:                     $ => /[sS][iI][zZ][eE]-[cC][hH][aA][rR][sS]/,
    _SIZE_PIXELS:                    $ => /[sS][iI][zZ][eE]-[pP][iI][xX][eE][lL][sS]/,
    _SKIP:                           $ => /[sS][kK][iI][pP]/,
    _SORT:                           $ => /[sS][oO][rR][tT]/,
    _SOURCE:                         $ => /[sS][oO][uU][rR][cC][eE]/,
    _SPACE:                          $ => /[sS][pP][aA][cC][eE]/,
    _STOP:                           $ => /[sS][tT][oO][pP]/,
    _STOP_AFTER:                     $ => /[sS][tT][oO][pP]-[aA][fF][tT][eE][rR]/,
    _STRETCH_TO_FIT:                 $ => /[sS][tT][rR][eE][tT][cC][hH]-[tT][oO]-[fF][iI][tT]/,
    _SUBSCRIBE:                      $ => /[sS][uU][bB][sS][cC][rR][iI][bB][eE]/,

    _SHARED:                         $ => /[sS][hH][aA][rR][eE][dD]/,
    _SHARE_LOCK:                     $ => /[sS][hH][aA][rR][eE]-[lL][oO][cC][kK]/,

    _SINGLE:                         $ => /[sS][iI][nN][gG][lL][eE]/,
    _SINGLE_RUN:                     $ => /[sS][iI][nN][gG][lL][eE]-[rR][uU][nN]/,
    _SINGLETON:                      $ => /[sS][iI][nN][gG][lL][eE][tT][oO][nN]/,

    _STATIC:                         $ => /[sS][tT][aA][tT][iI][cC]/,

    _STREAM:                         $ => /[sS][tT][rR][eE][aA][mM]/,
    _STREAM_HANDLE:                  $ => /[sS][tT][rR][eE][aA][mM]-[hH][aA][nN][dD][lL][eE]/,
    _STREAM_IO:                      $ => /[sS][tT][rR][eE][aA][mM]-[iI][oO]/,

    _SUB_AVERAGE:                    $ => /[sS][uU][bB]-[aA][vV][eE][rR][aA][gG][eE]/,
    _SUB_COUNT:                      $ => /[sS][uU][bB]-[cC][oO][uU][nN][tT]/,
    _SUB_MAXIMUM:                    $ => /[sS][uU][bB]-[mM][aA][xX][iI][mM][uU][mM]/,
    _SUB_MINIMUM:                    $ => /[sS][uU][bB]-[mM][iI][nN][iI][mM][uU][mM]/,
    _SUB_TOTAL:                      $ => /[sS][uU][bB]-[tT][oO][tT][aA][lL]/,

    _T:                              $ => /[tT]/,
    _TABLE:                          $ => /[tT][aA][bB][lL][eE]/,
    _TABLE_HANDLE:                   $ => /[tT][aA][bB][lL][eE]-[hH][aA][nN][dD][lL][eE]/,

    _TEARDOWN:                       $ => /[tT][eE][aA][rR][dD][oO][wW][nN]/,

    _TEMP_TABLE:                     $ => /[tT][eE][mM][pP]-[tT][aA][bB][lL][eE]/,

    _TEST:                           $ => /[tT][eE][sS][tT]/,
    _TESTSUITE:                      $ => /[tT][eE][sS][tT][sS][uU][iI][tT][eE]/,

    _THIS_PROCEDURE:                 $ => /[tT][hH][iI][sS]-[pP][rR][oO][cC][eE][dD][uU][rR][eE]/,

    _TO:                             $ => /[tT][oO]/,
    _TOP:                            $ => /[tT][oO][pP]/,
    _TOP_ONLY:                       $ => /[tT][oO][pP]-[oO][nN][lL][yY]/,
    _TOTAL:                          $ => /[tT][oO][tT][aA][lL]/,

    _TRUE:                           $ => /[tT][rR][uU][eE]/,
    _TARGET:                         $ => /[tT][aA][rR][gG][eE][tT]/,
    _TELL:                           $ => /[tT][eE][lL][lL]/,
    _TEXT:                           $ => /[tT][eE][xX][tT]/,
    _THEN:                           $ => /[tT][hH][eE][nN]/,
    _THROUGH:                        $ => /[tT][hH][rR][oO][uU][gG][hH]/,
    _THROW:                          $ => /[tT][hH][rR][oO][wW]/,
    _TIC_MARKS:                      $ => /[tT][iI][cC]-[mM][aA][rR][kK][sS]/,
    _TITLE:                          $ => /[tT][iI][tT][lL][eE]/,
    _TOGGLE_BOX:                     $ => /[tT][oO][gG][gG][lL][eE]-[bB][oO][xX]/,
    _TRANSACTION:                    $ => /[tT][rR][aA][nN][sS][aA][cC][tT][iI][oO][nN]/,
    _TRANSPARENT:                    $ => /[tT][rR][aA][nN][sS][pP][aA][rR][eE][nN][tT]/,

    _U:                              $ => /[uU]/,

    _UNIQUE:                         $ => /[uU][nN][iI][qQ][uU][eE]/,
    _UNDERLINE:                      $ => /[uU][nN][dD][eE][rR][lL][iI][nN][eE]-/,
    _UNDO:                           $ => /[uU][nN][dD][oO]/,
    _UNIQUE_MATCH:                   $ => /[uU][nN][iI][qQ][uU][eE]-[mM][aA][tT][cC][hH]/,
    _UPDATE:                         $ => /[uU][pP][dD][aA][tT][eE]/,
    _UNBUFFERED:                     $ => /[uU][nN][bB][uU][fF][fF][eE][rR][eE][dD]/,
    _UNLESS_HIDDEN:                  $ => /[uU][nN][lL][eE][sS][sS]-[hH][iI][dD][dD][eE][nN]/,

    _USE_INDEX:                      $ => /[uU][sS][eE]-[iI][nN][dD][eE][xX]/,
    _USE_TEXT:                       $ => /[uU][sS][eE]-[tT][eE][xX][tT]/,
    _USE_WIDGET_POOL:                $ => /[uU][sS][eE]-[wW][iI][dD][gG][eE][tT]-[pP][oO][oO][lL]/,
    _USING:                          $ => /[uU][sS][iI][nN][gG]/,

    _VALIDATE:                       $ => /[vV][aA][lL][iI][dD][aA][tT][eE]/,
    _VALUE:                          $ => /[vV][aA][lL][uU][eE]/,
    _VAR:                            $ => /[vV][aA][rR]/,
    _VARIABLE:                       $ => /[vV][aA][rR][iI][aA][bB][lL][eE]/,
    _VERTICAL:                       $ => /[vV][eE][rR][tT][iI][cC][aA][lL]/,
    _VIEW_AS:                        $ => /[vV][iI][eE][wW]-[aA][sS]/,
    _VOID:                           $ => /[vV][oO][iI][dD]/,

    _WAIT:                           $ => /[wW][aA][iI][tT]/,
    _WARNING:                        $ => /[wW][aA][rR][nN][iI][nN][gG]/,
    _WHEN:                           $ => /[wW][hH][eE][nN]/,
    _WHERE:                          $ => /[wW][hH][eE][rR][eE]/,
    _WHILE:                          $ => /[wW][hH][iI][lL][eE]/,
    _WIDGET_ID:                      $ => /[wW][iI][dD][gG][eE][tT]-[iI][dD]/,
    _WIDTH:                          $ => /[wW][iI][dD][tT][hH]/,
    _WINDOW:                         $ => /[wW][iI][nN][dD][oO][wW]/,
    _WITH:                           $ => /[wW][iI][tT][hH]/,
    _WORKFILE:                       $ => /[wW][oO][rR][kK][fF][iI][lL][eE]/,
    _WORK_TABLE:                     $ => /[wW][oO][rR][kK]-[tT][aA][bB][lL][eE]/,
    _WRITE:                          $ => /[wW][rR][iI][tT][eE]/,

    _X:                              $ => /[xX]/,
    _XML_DATA_TYPE:                  $ => /[xX][mM][lL]-[dD][aA][tT][aA]-[tT][yY][pP][eE]/,
    _XML_NODE_NAME:                  $ => /[xX][mM][lL]-[nN][oO][dD][eE]-[nN][aA][mM][eE]/,
    _XML_NODE_TYPE:                  $ => /[xX][mM][lL]-[nN][oO][dD][eE]-[tT][yY][pP][eE]/,

    _WORD_INDEX:                     $ => /[wW][oO][rR][dD]-[iI][nN][dD][eE][xX]/,

    _Y:                              $ => /[yY]/,
    _YES:                            $ => /[yY][eE][sS]/,
    _YES_NO:                         $ => /[yY][eE][sS]-[nN][oO]/,
    _YES_NO_CANCEL:                  $ => /[yY][eE][sS]-[nN][oO]-[cC][aA][nN][cC][eE][lL]/,
    _YES_NO_HELP:                    $ => /[yY][eE][sS]-[nN][oO]-[hH][eE][lL][pP]/,

    _ALERT_BOX:                      $ => /[aA][lL][eE][rR][tT]-[bB][oO][xX]/,

  }
});

function _list(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)));
}

