export function SacredMarquee() {
  const phrases = ["Hajj essentials", "Umrah preparation", "Pilgrim guidance", "Travel comfort", "Prayer & reflection", "Gifts with meaning"];
  const repeated = [...phrases, ...phrases];
  return (
    <div className="sacred-marquee" aria-label="HajjMart categories">
      <div className="sacred-marquee-track">
        {repeated.map((phrase, index) => <span key={`${phrase}-${index}`}><b>✦</b>{phrase}</span>)}
      </div>
    </div>
  );
}
