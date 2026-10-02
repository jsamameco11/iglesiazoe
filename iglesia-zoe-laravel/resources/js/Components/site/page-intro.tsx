import { LeadTitle } from "@/Components/site/lead-title";
import { section } from "@/lib/design";

export function PageIntro({
  skin,
  kicker,
  title,
  children,
  media,
}: {
  skin: "aire" | "marea";
  kicker: string;
  title: string;
  children?: React.ReactNode;
  media?: React.ReactNode;
}) {
  if (skin === "marea") {
    return (
      <header {...section("intro", "Portada")} className={`grid items-center gap-10 border-b border-ink/10 pb-14 lg:gap-16 ${media ? "lg:grid-cols-2" : ""}`}>
        <div>
          <p className="kicker">{kicker}</p>
          <LeadTitle text={title} className="mt-4 text-5xl md:text-7xl" />
          {children}
        </div>
        {media ? <figure className="luz-figure m-0">{media}</figure> : null}
      </header>
    );
  }

  return (
    <header {...section("intro", "Portada")} className={media ? "grid items-center gap-10 lg:grid-cols-2 lg:gap-16" : undefined}>
      <div>
        <p className="kicker">{kicker}</p>
        <LeadTitle text={title} className="mt-4 text-5xl md:text-7xl" />
        {children}
      </div>
      {media}
    </header>
  );
}
