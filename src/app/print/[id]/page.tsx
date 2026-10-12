import { Fragment } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getPrintOut } from "@/lib/printouts-server";
import { lineLabels, printOutUrl } from "@/lib/printouts";
import { QrCode } from "@/components/QrCode";
import { PrintControls } from "./PrintControls";
import "./paper.css";

export const dynamic = "force-dynamic";

const printedOn = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "short",
  day: "numeric",
  month: "short",
});

/**
 * A print-out on paper: numbered lines with boxes to tick by hand, and a QR
 * code that opens the same list in the app to tick back in afterwards.
 * Plain black on white, whatever the app's theme, because it's for a printer.
 */
export default async function PrintPage({ params }: PageProps<"/print/[id]">) {
  const { id } = await params;
  const printOut = await getPrintOut(id);
  if (!printOut) notFound();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const back = `${proto}://${host}${printOutUrl(printOut.id)}`;

  const labels = lineLabels(printOut.lines);
  const things = printOut.lines.filter((l) => !l.stepId).length || printOut.lines.length;

  return (
    <main className="paper-screen">
      <PrintControls />
      <article className="paper">
        <header className="paper-head">
          <div>
            <h1>{printOut.title}</h1>
            <p>
              Printed {printedOn.format(new Date(printOut.createdAt))} by {printOut.createdBy} · {things}{" "}
              {things === 1 ? "thing" : "things"}
            </p>
          </div>
          <figure className="paper-qr">
            <QrCode value={back} size="26mm" label="QR code to tick this list off in the app" />
            <figcaption>Done? Scan to tick these off in the app.</figcaption>
          </figure>
        </header>

        <ol className="paper-lines">
          {printOut.lines.map((line, i) => {
            const heading = line.group && line.group !== printOut.lines[i - 1]?.group ? line.group : null;
            return (
              <Fragment key={`${line.itemId}-${line.stepId ?? ""}-${i}`}>
                {heading && <li className="paper-group">{heading}</li>}
                <li className={line.stepId && labels[i].match(/[a-z]$/) ? "paper-line paper-step" : "paper-line"}>
                  <span className="paper-n">{labels[i]}</span>
                  <span className="paper-box" aria-hidden="true" />
                  <span className="paper-text">{line.text}</span>
                </li>
              </Fragment>
            );
          })}
        </ol>

        <footer className="paper-foot">The House List</footer>
      </article>
    </main>
  );
}
