import type { PublicIncident } from "../../api.js";
export function IncidentTimeline({ incident }: { incident: PublicIncident }) { return <ol className="incident-timeline" aria-label={`Evidence timeline for ${incident.id}`}><li><time dateTime={incident.openedAt}>{incident.openedAt}</time><span>Reviewed incident opened</span></li><li><span>{incident.summary}</span></li></ol>; }
