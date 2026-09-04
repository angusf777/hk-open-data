const correctionEndpoint = "https://github.com/angusf777/hk-open-data/issues/new";

export function correctionIssueUrl(reference: string): string {
  const parameters = new URLSearchParams({
    template: "correction.yml",
    title: `[Correction]: ${reference}`,
  });
  return `${correctionEndpoint}?${parameters.toString()}`;
}
