#include <tree_sitter/parser.h>
#include <wctype.h>
#include <stdio.h>

enum TokenType {
  NAMEDOT,
  NAMECOLON,
  NAMEDOUBLECOLON,
  OR_OPERATOR,
  AND_OPERATOR, 
  AUGMENTED_ASSIGNMENT,
  ESCAPED_STRING,
};

void *tree_sitter_abl_external_scanner_create() {
  return NULL;
}

void tree_sitter_abl_external_scanner_destroy(void *payload) {
}

unsigned int tree_sitter_abl_external_scanner_serialize(
  void *payload, char *buffer
) {
  return 0u;
}

void tree_sitter_abl_external_scanner_deserialize(
  void *payload, const char *buffer, unsigned int length
) {
}

bool insensitive_equals(int32_t codepoint, char character) {
  const int32_t uppercase_codepoint = (int32_t)character;
  return uppercase_codepoint == codepoint || (uppercase_codepoint  + 0x0020) == codepoint;
}

bool tree_sitter_abl_external_scanner_scan(
  void *payload,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  if (valid_symbols[NAMEDOT] || valid_symbols[NAMECOLON] || valid_symbols[NAMEDOUBLECOLON]) {
    while (!lexer->eof(lexer) && iswspace(lexer->lookahead)) {
      lexer->advance(lexer, true);
    }

    if (!lexer->eof(lexer) && lexer->lookahead == '.') {
      lexer->advance(lexer, false);
      if (!lexer->eof(lexer) && !iswspace(lexer->lookahead)) {
        lexer->result_symbol = NAMEDOT;
        return true;
      }
    }
    else if (!lexer->eof(lexer) && lexer->lookahead == ':') {
      lexer->advance(lexer, false);

      if (!lexer->eof(lexer) && lexer->lookahead == ':') {
        lexer->advance(lexer, false);
        if (!iswspace(lexer->lookahead)) {
          lexer->result_symbol = NAMEDOUBLECOLON;
          return true;
        }
      }
      else if (!lexer->eof(lexer) && !iswspace(lexer->lookahead)) {
        lexer->result_symbol = NAMECOLON;
        return true;
      }
    }
  }

  if (valid_symbols[OR_OPERATOR] || valid_symbols[AND_OPERATOR] || valid_symbols[AUGMENTED_ASSIGNMENT]) {
    while (!lexer->eof(lexer) && iswspace(lexer->lookahead)) {
      lexer->advance(lexer, true);
    }

    if (!lexer->eof(lexer) && insensitive_equals(lexer->lookahead, 'O')) {
      lexer->advance(lexer, false);
      if (!lexer->eof(lexer) && insensitive_equals(lexer->lookahead, 'R')) {
        lexer->advance(lexer, false);
        if (!lexer->eof(lexer) && iswspace(lexer->lookahead)) {
          lexer->result_symbol = OR_OPERATOR;
          return true;
        }
      }
    }
    else if (!lexer->eof(lexer) && insensitive_equals(lexer->lookahead, 'A')) {
      lexer->advance(lexer, false);
      if (!lexer->eof(lexer) && insensitive_equals(lexer->lookahead, 'N')) {
        lexer->advance(lexer, false);
        if (!lexer->eof(lexer) && insensitive_equals(lexer->lookahead,'D')) {
          lexer->advance(lexer, false);
          if (!lexer->eof(lexer) && iswspace(lexer->lookahead)) {
            lexer->result_symbol = AND_OPERATOR;
            return true;
          }
        }
      }
    }
    else if (!lexer->eof(lexer) && (lexer->lookahead == '+' || lexer->lookahead == '-' || lexer->lookahead == '*' || lexer->lookahead == '/' )) {
      lexer->advance(lexer, false);
      if (!lexer->eof(lexer) && insensitive_equals(lexer->lookahead, '=')) {
        lexer->advance(lexer, false);
        if (!lexer->eof(lexer) && iswspace(lexer->lookahead)) {
          lexer->result_symbol = AUGMENTED_ASSIGNMENT;
          return true;
        }
      }
    }
  }

  if (valid_symbols[ESCAPED_STRING] && (lexer->lookahead == '"' || lexer->lookahead == '\'')) {
    char start = lexer->lookahead;
    lexer->advance(lexer, false);

    while (!lexer->eof(lexer) && lexer->lookahead != start) {
      if (lexer->lookahead == '~') {
        lexer->advance(lexer, false);
        if (!lexer->eof(lexer)) 
          lexer->advance(lexer, false);
      }
      else lexer->advance(lexer, false);
    }

    if (!lexer->eof(lexer) && lexer->lookahead == start) {
      lexer->advance(lexer, false);
      lexer->result_symbol = ESCAPED_STRING;
      return true;
    }
  }

  return false;
}

