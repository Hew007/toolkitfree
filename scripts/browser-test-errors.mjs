export function filterActionableBrowserErrors(errors) {
  return errors.filter((error) => {
    const googleAdReportOnly =
      error.includes("Framing 'https://www.google.com/' violates") &&
      error.includes('report-only Content Security Policy') &&
      error.includes("frame-ancestors 'self'");
    return !googleAdReportOnly;
  });
}
