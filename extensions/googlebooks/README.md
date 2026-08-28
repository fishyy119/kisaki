# Google Books Extension

Built-in Google Books integration for Kisaki.

- Novel scraper provider backed by the volumes API: worldwide bibliographic
  data with title, author, and ISBN operators. Works without any key on a low
  shared quota; a personal API key raises it. Entries hand over ISBNs, the
  shared cross-source book id.
- Import integration: sign in through the Kisaki OAuth relay and import the
  purchased "My Google eBooks" library and the predefined reading shelves
  (to-read, reading, have-read) as entry statuses. Series volumes can be
  merged so one work does not arrive as a dozen entries. Google Books carries
  purchases rather than tracking habits, so nothing is pushed back.
