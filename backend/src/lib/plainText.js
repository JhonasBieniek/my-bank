const HTML_TAG_PATTERN = /<[^>]*>/;

function containsHtmlTags(value) {
  return typeof value === 'string' && HTML_TAG_PATTERN.test(value);
}

module.exports = { containsHtmlTags, HTML_TAG_PATTERN };
