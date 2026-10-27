/** A Markdown file imported as its text (`loader` of angular.json), e.g. the CHANGELOG. */
declare module '*.md' {
  const text: string;
  export default text;
}
