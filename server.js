<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<meta name="theme-color" content="#0a0a0f">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Undercover">
<link rel="manifest" href="data:application/json,%7B%22name%22%3A%22Undercover%20Anim%C3%A9%22%2C%22short_name%22%3A%22Undercover%22%2C%22start_url%22%3A%22.%22%2C%22display%22%3A%22standalone%22%2C%22background_color%22%3A%22%230a0a0f%22%2C%22theme_color%22%3A%22%230a0a0f%22%2C%22icons%22%3A%5B%7B%22src%22%3A%22data%3Aimage%2Fsvg%2Bxml%2C%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%20100%20100'%3E%3Ctext%20y%3D'.9em'%20font-size%3D'90'%3E%F0%9F%95%B5%EF%B8%8F%3C%2Ftext%3E%3C%2Fsvg%3E%22%2C%22sizes%22%3A%22any%22%2C%22type%22%3A%22image%2Fsvg%2Bxml%22%7D%5D%7D">
<title>UNDERCOVER — Animé</title>
<link href="https://fonts.googleapis.com/css2?family=Zen+Dots&family=Permanent+Marker&family=Noto+Sans+JP:wght@300;400;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.min.js"></script>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
:root{
  --ink:#0a0a0f; --ink2:#12121a; --ink3:#1a1a26;
  --border:rgba(255,255,255,.07); --border2:rgba(255,255,255,.14);
  --red:#ff2d55; --red2:#c4002a;
  --gold:#ffd60a; --gold2:#b59500;
  --cyan:#00e5ff; --green:#00ff87; --purple:#bf5af2;
  --muted:#4a4a6a; --text:#e8e8f0; --text2:#7070a0;
  --fd:'Zen Dots',sans-serif;
  --fm:'Share Tech Mono',monospace;
  --fb:'Noto Sans JP',sans-serif;
  --fmark:'Permanent Marker',cursive;
}
html{background:var(--ink);color:var(--text);font-family:var(--fb);min-height:100vh;overflow-x:hidden}
body::before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");pointer-events:none;z-index:9998}
.screen{display:none;min-height:100vh;position:relative;z-index:1}
.screen.active{display:flex;flex-direction:column;align-items:center}

/* ── HOME ── */
#s-home{justify-content:center;padding:0 16px;overflow:visible;background:var(--ink)}
.hbg{position:absolute;inset:0;background:radial-gradient(ellipse 70% 50% at 75% 15%,rgba(255,45,85,.13) 0%,transparent 60%),radial-gradient(ellipse 50% 60% at 15% 80%,rgba(0,229,255,.07) 0%,transparent 60%),radial-gradient(ellipse 90% 40% at 50% 100%,rgba(255,214,10,.05) 0%,transparent 50%);pointer-events:none}
.hgrid{position:absolute;inset:0;background-image:linear-gradient(90deg,var(--border) 1px,transparent 1px),linear-gradient(0deg,var(--border) 1px,transparent 1px);background-size:56px 56px;pointer-events:none;mask-image:radial-gradient(ellipse at center,rgba(0,0,0,.6) 0%,transparent 72%)}
.hinner{position:relative;z-index:2;text-align:center;max-width:440px;width:100%;padding:54px 4px 40px}
.hbadge{display:inline-flex;align-items:center;gap:8px;font-family:var(--fm);font-size:10px;letter-spacing:.3em;color:var(--cyan);border:1px solid rgba(0,229,255,.3);padding:5px 14px;margin-bottom:28px;animation:fd .6s ease both}
.hbadge::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--cyan);box-shadow:0 0 8px var(--cyan);animation:blink 1.5s infinite}
.htitle{font-family:var(--fd);font-size:clamp(44px,11.5vw,88px);line-height:.92;letter-spacing:-.01em;animation:tIn .7s cubic-bezier(.16,1,.3,1) .1s both;padding:0 12px;overflow:visible;width:100%}
.htitle .l1{display:block;color:var(--text)}
.htitle .l2{display:block;background:linear-gradient(135deg,var(--red) 0%,var(--gold) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hsub{font-family:var(--fm);font-size:11px;letter-spacing:.35em;color:var(--muted);margin:14px 0 40px;animation:fu .6s ease .3s both}
.hcards{display:grid;grid-template-columns:1fr 1fr;gap:12px;animation:fu .6s ease .4s both}
.hcard{background:var(--ink2);border:1px solid var(--border2);padding:22px 18px;cursor:pointer;transition:all .2s cubic-bezier(.16,1,.3,1);text-align:left;position:relative;overflow:hidden}
.hcard::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--red),var(--gold));transform:scaleX(0);transform-origin:left;transition:transform .25s}
.hcard:hover{transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,0,0,.5)}
.hcard:hover::after{transform:scaleX(1)}
.hci{font-size:28px;margin-bottom:10px;display:block}
.hct{font-family:var(--fd);font-size:17px;letter-spacing:.05em}
.hcd{font-family:var(--fm);font-size:10px;color:var(--muted);margin-top:4px}
.hfooter{margin-top:26px;display:flex;gap:10px;justify-content:center;animation:fu .6s ease .5s both}

/* ── TOPBAR ── */
.topbar{width:100%;display:flex;align-items:center;justify-content:space-between;padding:13px 20px;border-bottom:1px solid var(--border);background:rgba(10,10,15,.92);backdrop-filter:blur(20px);position:sticky;top:0;z-index:50}
.tlogo{font-family:var(--fd);font-size:17px;letter-spacing:.05em}
.tlogo span{background:linear-gradient(90deg,var(--red),var(--gold));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.tcode{font-family:var(--fm);font-size:13px;color:var(--gold);border:1px solid rgba(255,214,10,.25);padding:4px 12px;letter-spacing:.2em}

/* ── WRAP ── */
.wrap{width:100%;max-width:480px;padding:24px 20px}
.stag{font-family:var(--fm);font-size:9px;letter-spacing:.3em;text-transform:uppercase;color:var(--red);margin-bottom:7px}
.ptitle{font-family:var(--fd);font-size:28px;letter-spacing:.04em;margin-bottom:22px;line-height:1.1}

/* ── FIELDS ── */
.field{margin-bottom:18px}
.field label{display:block;font-family:var(--fm);font-size:9px;letter-spacing:.25em;color:var(--gold);text-transform:uppercase;margin-bottom:7px}
.field input,.field select{width:100%;background:var(--ink2);border:none;border-bottom:1px solid var(--border2);color:var(--text);font-family:var(--fb);font-size:15px;padding:11px 13px;outline:none;transition:border-color .2s;-webkit-appearance:none}
.field input:focus,.field select:focus{border-bottom-color:var(--gold)}
.field select option{background:var(--ink2)}
.code-input{font-size:36px!important;letter-spacing:.35em!important;font-family:var(--fd)!important;text-transform:uppercase;text-align:center}
.chips{display:flex;flex-wrap:wrap;gap:7px}
.chip{background:transparent;border:1px solid var(--border2);color:var(--muted);font-family:var(--fm);font-size:10px;padding:6px 13px;cursor:pointer;transition:all .15s;letter-spacing:.08em}
.chip.on,.chip:hover{border-color:var(--gold);color:var(--gold);background:rgba(255,214,10,.06)}
.toggle-row{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border)}
.toggle-label{font-size:13px;font-weight:700}
.toggle-sub{font-family:var(--fm);font-size:10px;color:var(--muted);margin-top:2px}
.toggle{position:relative;width:44px;height:24px;flex-shrink:0}
.toggle input{opacity:0;width:0;height:0}
.toggle-slider{position:absolute;inset:0;background:var(--ink3);border:1px solid var(--border2);border-radius:24px;cursor:pointer;transition:all .2s}
.toggle-slider::before{content:'';position:absolute;width:18px;height:18px;left:2px;top:2px;background:var(--muted);border-radius:50%;transition:all .2s}
.toggle input:checked + .toggle-slider{background:rgba(255,214,10,.15);border-color:var(--gold)}
.toggle input:checked + .toggle-slider::before{transform:translateX(20px);background:var(--gold)}

/* ── BUTTONS ── */
.btn{font-family:var(--fd);font-size:15px;letter-spacing:.1em;border:none;cursor:pointer;padding:13px 26px;transition:all .2s cubic-bezier(.16,1,.3,1);display:inline-flex;align-items:center;gap:8px;position:relative;overflow:hidden}
.btn::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.08) 0%,transparent 50%);pointer-events:none}
.btn-red{background:linear-gradient(135deg,var(--red),var(--red2));color:#fff;box-shadow:0 4px 20px rgba(255,45,85,.3)}
.btn-red:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(255,45,85,.45)}
.btn-gold{background:linear-gradient(135deg,var(--gold),var(--gold2));color:var(--ink);box-shadow:0 4px 20px rgba(255,214,10,.25)}
.btn-gold:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(255,214,10,.4)}
.btn-outline{background:transparent;border:1px solid var(--border2);color:var(--text2);font-size:13px;padding:10px 18px}
.btn-outline:hover{border-color:rgba(255,255,255,.3);color:var(--text)}
.btn-green{background:linear-gradient(135deg,var(--green),#00cc6a);color:var(--ink);font-size:14px;padding:11px 20px;box-shadow:0 4px 18px rgba(0,255,135,.2)}
.btn-green:hover{transform:translateY(-2px)}
.btn-red-sm{background:var(--red);color:#fff;font-size:13px;padding:9px 16px}
.btn:disabled{opacity:.3;pointer-events:none;transform:none!important;box-shadow:none!important}
.btn-full{width:100%;justify-content:center}
.btn-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}

/* ── LOBBY ── */
.code-box{background:var(--ink2);border:1px solid var(--border2);border-left:3px solid var(--gold);padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between}
.cb-label{font-family:var(--fm);font-size:9px;letter-spacing:.25em;color:var(--muted);margin-bottom:3px}
.cb-val{font-family:var(--fd);font-size:40px;letter-spacing:.25em;color:var(--gold)}
.prow{display:flex;align-items:center;gap:11px;padding:11px 14px;background:var(--ink2);border:1px solid var(--border);margin-bottom:7px;animation:sIn .3s cubic-bezier(.16,1,.3,1) both}
.sdot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);flex-shrink:0}
.sdot.off{background:var(--muted);box-shadow:none}
.pname{font-size:14px;font-weight:700}
.ptag{font-family:var(--fm);font-size:9px;color:var(--muted);margin-top:2px;letter-spacing:.1em}
.pkick{margin-left:auto;background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:4px 8px;transition:color .2s}
.pkick:hover{color:var(--red)}
.info-box{border:1px solid var(--border);border-left:2px solid var(--cyan);background:rgba(0,229,255,.04);padding:11px 14px;font-family:var(--fm);font-size:11px;color:var(--muted);line-height:1.7;margin-bottom:14px}

/* ── SCORES ── */
.scores-box{background:var(--ink2);border:1px solid var(--border);padding:14px 16px;margin-bottom:18px}
.scores-title{font-family:var(--fm);font-size:9px;letter-spacing:.25em;color:var(--gold);text-transform:uppercase;margin-bottom:10px}
.score-row{display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)}
.score-row:last-child{border:none}
.score-name{font-size:13px;font-weight:700}
.score-val{font-family:var(--fd);font-size:16px;color:var(--gold)}

/* ── REVEAL ── */
#s-reveal{background:var(--ink);justify-content:center;padding:30px 20px;overflow:hidden}
#s-reveal::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 50% 50%,rgba(255,45,85,.07) 0%,transparent 70%);pointer-events:none}
.rv-label{font-family:var(--fm);font-size:10px;letter-spacing:.25em;color:var(--muted);margin-bottom:24px;text-transform:uppercase;animation:blink 2s infinite}
.card-scene{perspective:1600px;width:260px;margin:0 auto}
.card-3d{width:260px;height:380px;transform-style:preserve-3d;transition:transform .7s cubic-bezier(.4,0,.2,1);cursor:pointer;position:relative}
.card-3d.flipped{transform:rotateY(180deg)}
.card-face{position:absolute;inset:0;backface-visibility:hidden;border-radius:12px;overflow:hidden}
.c-back{background:linear-gradient(145deg,#1a1a2e,#0f0f1a);border:1px solid var(--border2);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
.c-back-pat{position:absolute;inset:0;background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.018) 0px,rgba(255,255,255,.018) 1px,transparent 1px,transparent 14px),repeating-linear-gradient(-45deg,rgba(255,255,255,.018) 0px,rgba(255,255,255,.018) 1px,transparent 1px,transparent 14px)}
.c-back-bdr{position:absolute;inset:8px;border:1px solid rgba(255,255,255,.055);border-radius:8px}
.c-back-logo{font-family:var(--fd);font-size:50px;letter-spacing:.05em;position:relative;z-index:1;background:linear-gradient(135deg,var(--red),var(--gold));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.c-back-tap{font-family:var(--fm);font-size:10px;letter-spacing:.2em;color:var(--muted);position:relative;z-index:1;animation:blink 2s infinite}
.c-front{transform:rotateY(180deg);background:linear-gradient(165deg,#f5f0e8,#ede5d0);border:1px solid rgba(0,0,0,.1);display:flex;flex-direction:column;align-items:center;justify-content:flex-start;color:#1a1a1a}
.cf-header{width:100%;background:linear-gradient(90deg,#1a1a2e,#0f0f1a);padding:10px 14px;display:flex;align-items:center;justify-content:space-between}
.cf-role{font-family:var(--fm);font-size:9px;letter-spacing:.2em;color:rgba(255,255,255,.5);text-transform:uppercase}
.cf-num{font-family:var(--fd);font-size:11px;color:rgba(255,255,255,.2)}
.cf-img{width:100%;height:195px;overflow:hidden;position:relative;background:linear-gradient(135deg,#2a2a3e,#1a1a28)}
.cf-img img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block;filter:contrast(1.03) saturate(.97)}
.cf-img-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:60px}
.cf-img-ov{position:absolute;bottom:0;left:0;right:0;height:48px;background:linear-gradient(transparent,#ede5d0)}
.cf-body{flex:1;width:100%;padding:14px 16px 12px;display:flex;flex-direction:column;align-items:center;gap:7px}
.cf-name{font-family:var(--fd);font-size:24px;letter-spacing:.02em;text-align:center;color:#1a1a2e;line-height:1.1}
.cf-name.unk{font-family:var(--fb);font-style:italic;font-size:17px;color:#888;font-weight:300}
.cf-div{width:26px;height:2px;background:linear-gradient(90deg,var(--red),var(--gold))}
.cf-hint{font-family:var(--fm);font-size:10px;color:#666;text-align:center;line-height:1.6}
.cf-stamp{width:100%;display:flex;align-items:center;justify-content:center;padding:6px 0 0;border-top:1px solid rgba(0,0,0,.08)}
.cf-stamp-t{font-family:var(--fmark);font-size:13px;color:rgba(255,45,85,.22);transform:rotate(-3deg)}
.rv-tap{font-family:var(--fm);font-size:11px;color:var(--muted);letter-spacing:.2em;margin-top:20px;animation:blink 2s infinite}
#rv-done{display:none;margin-top:20px}

/* ── WAITING ── */
#s-waiting{background:var(--ink);padding:50px 20px;align-items:center}
.wait-icon{font-size:50px;animation:float 3s ease-in-out infinite;margin-bottom:14px}
.wait-title{font-family:var(--fd);font-size:30px;letter-spacing:.06em;margin-bottom:5px}
.wait-sub{font-family:var(--fm);font-size:11px;color:var(--muted);letter-spacing:.15em;margin-bottom:28px}
.rlist{width:100%;max-width:360px}
.rrow{display:flex;align-items:center;gap:11px;padding:9px 13px;background:var(--ink2);border:1px solid var(--border);margin-bottom:6px}
.rdot{width:8px;height:8px;border-radius:50%;background:var(--border2);flex-shrink:0;transition:all .3s}
.rdot.ok{background:var(--green);box-shadow:0 0 8px var(--green)}
.rname{font-size:14px;font-weight:700}
.rstatus{font-family:var(--fm);font-size:10px;color:var(--muted);margin-left:auto;letter-spacing:.08em}
.rstatus.done{color:var(--green)}

/* ── PLAYING ── */
.round-hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 0;margin-bottom:12px;border-bottom:1px solid var(--border)}
.round-num{font-family:var(--fd);font-size:13px;letter-spacing:.15em;color:var(--gold)}
.alive-cnt{font-family:var(--fm);font-size:11px;color:var(--muted)}

/* TIMER */
.timer-bar{width:100%;height:4px;background:var(--ink3);margin-bottom:14px;overflow:hidden;border-radius:2px}
.timer-fill{height:100%;background:linear-gradient(90deg,var(--green),var(--gold),var(--red));width:100%;transform-origin:left;transition:width 1s linear}
.timer-fill.urgent{animation:timerPulse .5s ease-in-out infinite}
.timer-label{font-family:var(--fm);font-size:10px;color:var(--muted);text-align:right;margin-top:3px;margin-bottom:10px}

/* MY WORD */
.my-word{background:var(--ink2);border:1px solid var(--border);border-left:3px solid var(--gold);padding:11px 15px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between}
.mw-l{font-family:var(--fm);font-size:9px;letter-spacing:.2em;color:var(--muted);text-transform:uppercase;margin-bottom:2px}
.mw-v{font-family:var(--fd);font-size:20px;color:var(--gold);letter-spacing:.04em}

/* PLAYERS */
.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:7px;margin-bottom:14px}
.pcard{background:var(--ink2);border:1px solid var(--border);padding:9px 11px;display:flex;align-items:center;gap:9px;transition:all .3s}
.pcard.dead{opacity:.22;filter:grayscale(1)}
.pcard.voted-for{border-color:rgba(255,45,85,.4);background:rgba(255,45,85,.06)}
.pc-em{font-size:19px;flex-shrink:0}
.pc-n{font-size:12px;font-weight:700}
.pc-s{font-family:var(--fm);font-size:9px;color:var(--muted);letter-spacing:.06em}
.pc-votes{font-family:var(--fm);font-size:10px;color:var(--red);margin-left:auto}

/* GAME BOXES */
.gbox{background:var(--ink2);border:1px solid var(--border);padding:16px;margin-bottom:12px}
.gbox-title{font-family:var(--fd);font-size:18px;letter-spacing:.06em;margin-bottom:8px}
.pbadge{display:inline-flex;align-items:center;gap:6px;font-family:var(--fm);font-size:9px;letter-spacing:.2em;padding:4px 11px;border:1px solid currentColor;margin-bottom:9px;text-transform:uppercase}
.pbw{color:var(--green);border-color:rgba(0,255,135,.3)}
.pbv{color:var(--red);border-color:rgba(255,45,85,.3)}

/* WORD INPUT */
.winput-row{display:flex;gap:8px;margin-bottom:10px}
.winput-row input{flex:1;background:var(--ink3);border:1px solid var(--border2);color:var(--text);font-family:var(--fb);font-size:15px;padding:10px 13px;outline:none;transition:border-color .2s}
.winput-row input:focus{border-color:var(--gold)}
.winput-row input.blocked{border-color:var(--red);animation:shake .3s ease}
.sub-notice{display:none;align-items:center;gap:8px;font-family:var(--fm);font-size:11px;color:var(--green);padding:7px 0;letter-spacing:.1em}
.sub-notice.show{display:flex}

/* WORDS LIST */
.wlist{margin-top:4px}
.wentry{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)}
.wentry:last-child{border:none}
.we-auth{font-family:var(--fm);font-size:10px;color:var(--muted);display:flex;align-items:center;gap:5px}
.we-word{font-weight:700;font-size:14px}
.we-pend{font-style:italic;color:var(--muted);font-size:12px;font-family:var(--fm);animation:blink 1.5s infinite}

.wentry.active-turn{background:rgba(255,214,10,.04);border-bottom-color:rgba(255,214,10,.2)}
.wentry.active-turn .we-auth{color:var(--gold)}

/* HISTORY */
.hist-section{margin-top:8px}
.hist-title{font-family:var(--fm);font-size:9px;letter-spacing:.2em;color:var(--muted);text-transform:uppercase;padding:6px 0;border-top:1px solid var(--border)}
.hist-row{display:flex;align-items:baseline;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.hist-round{font-family:var(--fm);font-size:9px;color:var(--muted);width:52px;flex-shrink:0}
.hist-words{font-size:12px;color:var(--text2);flex:1}

/* VOTE */
.wsummary{background:var(--ink3);border:1px solid var(--border);padding:12px 14px;margin-bottom:12px}
.ws-l{font-family:var(--fm);font-size:9px;letter-spacing:.2em;color:var(--muted);text-transform:uppercase;margin-bottom:7px}
.vbtn{width:100%;background:var(--ink3);border:1px solid var(--border);color:var(--text);font-family:var(--fb);font-size:14px;padding:12px 15px;cursor:pointer;text-align:left;transition:all .15s;display:flex;align-items:center;gap:11px;margin-bottom:6px;position:relative}
.vbtn:hover:not(:disabled){border-color:rgba(255,45,85,.45);background:rgba(255,45,85,.07)}
.vbtn.selected{border-color:var(--red);background:rgba(255,45,85,.12)}
.vbtn.leading{border-color:rgba(255,45,85,.5)}
.vbtn-votes{margin-left:auto;font-family:var(--fm);font-size:11px;color:var(--red)}
.vbtn:disabled{opacity:.35;cursor:default}
.host-tag{font-family:var(--fm);font-size:10px;color:var(--muted);border:1px solid var(--border);padding:8px 11px;margin-bottom:10px;line-height:1.6}
.tie-box{background:rgba(255,214,10,.08);border:1px solid rgba(255,214,10,.3);padding:14px;margin-bottom:12px;text-align:center}
.tie-title{font-family:var(--fd);font-size:16px;color:var(--gold);margin-bottom:8px}

/* MR WHITE */
.mrw-box{background:var(--ink2);border:1px solid rgba(255,214,10,.2);padding:16px;margin-bottom:12px;display:none}
.mrw-box.show{display:block}
.mrw-t{font-family:var(--fd);font-size:18px;color:var(--gold);margin-bottom:5px}
.mrw-s{font-family:var(--fm);font-size:11px;color:var(--muted);margin-bottom:12px;line-height:1.6}

/* ── ELIMINATION OVERLAY ── */
.elim-overlay{position:fixed;inset:0;z-index:8000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.88);backdrop-filter:blur(8px);opacity:0;pointer-events:none;transition:opacity .3s}
.elim-overlay.show{opacity:1;pointer-events:all;animation:none}
.elim-card{background:var(--ink2);border:1px solid var(--border2);padding:40px 32px;text-align:center;max-width:320px;width:90%;position:relative;animation:elimIn .5s cubic-bezier(.16,1,.3,1) both}
.elim-skull{font-size:64px;margin-bottom:16px;animation:shake .4s ease .3s both}
.elim-name{font-family:var(--fd);font-size:32px;color:var(--red);margin-bottom:8px;letter-spacing:.03em}
.elim-sub{font-family:var(--fm);font-size:12px;color:var(--muted);letter-spacing:.12em}
.elim-continue{display:none;margin-top:20px}

/* ── RESULT ── */
#s-result{background:var(--ink);justify-content:center;padding:40px 20px;overflow:hidden;text-align:center}
.res-glow-win{position:absolute;inset:0;background:radial-gradient(ellipse 70% 50% at 50% 30%,rgba(255,214,10,.1) 0%,transparent 60%);pointer-events:none}
.res-glow-lose{position:absolute;inset:0;background:radial-gradient(ellipse 70% 50% at 50% 30%,rgba(255,45,85,.1) 0%,transparent 60%);pointer-events:none}
.res-inner{position:relative;z-index:2;width:100%;max-width:400px}
.res-tag{font-family:var(--fm);font-size:9px;letter-spacing:.3em;color:var(--muted);text-transform:uppercase;margin-bottom:11px;animation:fd .4s ease both}
.res-title{font-family:var(--fd);font-size:clamp(52px,15vw,86px);line-height:.88;letter-spacing:-.01em;animation:tIn .5s cubic-bezier(.16,1,.3,1) .1s both}
.res-title.win{background:linear-gradient(135deg,var(--gold),#fff,var(--gold));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.res-title.lose{color:var(--red)}
.res-div{width:34px;height:2px;background:linear-gradient(90deg,var(--red),var(--gold));margin:14px auto}
.res-sub{font-family:var(--fm);font-size:11px;color:var(--muted);letter-spacing:.1em;margin-bottom:4px}
.res-card{background:var(--ink2);border:1px solid var(--border2);padding:18px;margin:18px 0;text-align:left;animation:fu .5s ease .2s both}
.rcr{display:flex;justify-content:space-between;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--border);font-size:13px}
.rcr:last-child{border:none}
.rcl{font-family:var(--fm);font-size:9px;letter-spacing:.15em;color:var(--muted);text-transform:uppercase;padding-top:2px}
.rcv{font-weight:700;text-align:right;max-width:58%}
.cv{color:var(--gold)}.rv{color:var(--red)}
.res-scores{background:var(--ink2);border:1px solid rgba(255,214,10,.2);padding:16px;margin-bottom:18px;text-align:left;animation:fu .5s ease .3s both}
.rs-title{font-family:var(--fm);font-size:9px;letter-spacing:.25em;color:var(--gold);text-transform:uppercase;margin-bottom:12px}
.rs-row{display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)}
.rs-row:last-child{border:none}
.rs-name{font-size:13px;font-weight:700}
.rs-score{font-family:var(--fd);font-size:16px;color:var(--gold)}
.rs-role{font-family:var(--fm);font-size:9px;color:var(--muted);margin-top:2px}

/* ── TOAST ── */
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(80px);background:var(--ink2);border:1px solid var(--border2);color:var(--text);font-family:var(--fm);font-size:12px;letter-spacing:.1em;padding:11px 22px;z-index:9999;transition:transform .3s cubic-bezier(.16,1,.3,1);pointer-events:none;white-space:nowrap;max-width:88vw;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.5)}
.toast.show{transform:translateX(-50%) translateY(0)}
.toast.ok{border-color:rgba(0,255,135,.3);color:var(--green)}
.toast.err{border-color:rgba(255,45,85,.3);color:var(--red)}
.toast.warn{border-color:rgba(255,214,10,.3);color:var(--gold)}

/* ── LOADING ── */
.loverlay{display:none;position:fixed;inset:0;background:rgba(10,10,15,.96);z-index:9990;align-items:center;justify-content:center;flex-direction:column;gap:16px;backdrop-filter:blur(10px)}
.loverlay.show{display:flex}
.l-text{font-family:var(--fd);font-size:20px;letter-spacing:.2em;color:var(--red)}
.l-bar{width:160px;height:1px;background:var(--border2);overflow:hidden}
.l-fill{height:100%;background:linear-gradient(90deg,var(--red),var(--gold));animation:slide 1.2s infinite ease-in-out}

/* ── ANIMATIONS ── */
@keyframes fd{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:none}}
@keyframes fu{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes tIn{from{opacity:0;transform:translateY(20px) scale(.96)}to{opacity:1;transform:none}}
@keyframes sIn{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
@keyframes elimIn{from{opacity:0;transform:scale(.88) translateY(20px)}to{opacity:1;transform:none}}
@keyframes timerPulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes scoreUp{from{opacity:0;transform:translateY(10px) scale(.9)}to{opacity:1;transform:none}}

/* ── WORD REVEAL CARD ── */
.word-reveal-overlay{position:fixed;inset:0;z-index:7000;display:flex;align-items:center;justify-content:center;pointer-events:none}
.word-reveal-card{background:var(--ink2);border:1px solid var(--border2);border-top:3px solid var(--gold);padding:0;width:min(88vw,340px);box-shadow:0 24px 60px rgba(0,0,0,.7);transform:translateY(40px) scale(.94);opacity:0;transition:transform .35s cubic-bezier(.16,1,.3,1), opacity .3s ease;pointer-events:none}
.word-reveal-card.show{transform:translateY(0) scale(1);opacity:1}
.wrc-top{padding:12px 18px 0;display:flex;align-items:center;gap:10px}
.wrc-emoji{font-size:22px}
.wrc-author{font-family:var(--fm);font-size:10px;letter-spacing:.2em;color:var(--muted);text-transform:uppercase}
.wrc-name{font-size:14px;font-weight:700;color:var(--text)}
.wrc-body{padding:14px 18px 18px;display:flex;align-items:center;gap:10px}
.wrc-said{font-family:var(--fm);font-size:10px;letter-spacing:.2em;color:var(--muted);text-transform:uppercase;margin-bottom:4px}
.wrc-word{font-family:var(--fd);font-size:32px;letter-spacing:.04em;color:var(--gold);line-height:1}
.wrc-bar{height:3px;background:linear-gradient(90deg,var(--red),var(--gold));animation:wrcBar .5s ease .1s both}
@keyframes wrcBar{from{transform:scaleX(0);transform-origin:left}to{transform:scaleX(1);transform-origin:left}}

@keyframes cdPulse{0%{transform:scale(1);opacity:1}50%{transform:scale(1.08);opacity:.8}100%{transform:scale(1);opacity:1}}


/* ══════════════════════════════════════════
   VOCAL PANEL
══════════════════════════════════════════ */
#voice-btn{position:fixed;bottom:80px;right:18px;z-index:6000;width:52px;height:52px;border-radius:50%;border:none;cursor:pointer;display:none;align-items:center;justify-content:center;font-size:22px;transition:all .25s cubic-bezier(.16,1,.3,1);box-shadow:0 4px 20px rgba(0,0,0,.5)}
#voice-btn.off{background:var(--ink3);border:1px solid var(--border2)}
#voice-btn.on{background:linear-gradient(135deg,var(--cyan),#0099bb);box-shadow:0 4px 20px rgba(0,229,255,.4)}
#voice-btn.speaking{animation:speakPulse .7s ease-in-out infinite}
#voice-btn.visible{display:flex}
@keyframes speakPulse{0%,100%{box-shadow:0 4px 20px rgba(0,229,255,.4)}50%{box-shadow:0 4px 36px rgba(0,229,255,.85),0 0 0 8px rgba(0,229,255,.12)}}

#voice-panel{position:fixed;bottom:146px;right:14px;z-index:6001;width:min(92vw,320px);background:var(--ink2);border:1px solid var(--border2);border-top:2px solid var(--cyan);box-shadow:0 16px 48px rgba(0,0,0,.7);display:none;flex-direction:column;overflow:hidden;transform:translateY(16px) scale(.97);opacity:0;transition:transform .3s cubic-bezier(.16,1,.3,1),opacity .25s}
#voice-panel.show{display:flex;transform:none;opacity:1}

.vp-head{padding:12px 16px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.vp-title{font-family:var(--fd);font-size:14px;letter-spacing:.08em;display:flex;align-items:center;gap:8px}
.vp-dot{width:7px;height:7px;border-radius:50%;background:var(--muted)}
.vp-dot.live{background:var(--cyan);box-shadow:0 0 8px var(--cyan);animation:blink 1.5s infinite}
.vp-close{background:none;border:none;color:var(--muted);cursor:pointer;font-size:18px;line-height:1;padding:2px 6px;transition:color .15s}
.vp-close:hover{color:var(--text)}

.vp-device{padding:10px 14px;border-bottom:1px solid var(--border)}
.vp-device label{font-family:var(--fm);font-size:9px;letter-spacing:.2em;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:5px}
.vp-device select{width:100%;background:var(--ink3);border:1px solid var(--border2);color:var(--text);font-family:var(--fb);font-size:12px;padding:7px 10px;outline:none;border-radius:0;-webkit-appearance:none;appearance:none;cursor:pointer}
.vp-device select:focus{border-color:var(--cyan)}

.vp-peers{padding:8px 0;max-height:240px;overflow-y:auto}
.vp-peer{display:flex;align-items:center;gap:11px;padding:9px 16px;transition:background .15s}
.vp-peer:hover{background:rgba(255,255,255,.03)}
.vp-peer-em{font-size:18px;width:26px;text-align:center;flex-shrink:0;position:relative}
.vp-speaking-ring{position:absolute;inset:-3px;border-radius:50%;border:2px solid var(--cyan);opacity:0;transition:opacity .15s}
.vp-speaking-ring.active{opacity:1;animation:speakRing .6s ease-in-out infinite}
@keyframes speakRing{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
.vp-peer-info{flex:1;min-width:0}
.vp-peer-name{font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vp-peer-status{font-family:var(--fm);font-size:9px;color:var(--muted);margin-top:1px;letter-spacing:.06em}
.vp-peer-vol{margin-left:auto;display:flex;align-items:center;gap:6px;flex-shrink:0}
.vp-mute-btn{background:none;border:1px solid var(--border2);color:var(--muted);cursor:pointer;font-size:13px;padding:3px 8px;border-radius:2px;transition:all .15s;line-height:1}
.vp-mute-btn:hover{border-color:var(--red);color:var(--red)}
.vp-mute-btn.muted{background:rgba(255,45,85,.1);border-color:rgba(255,45,85,.3);color:var(--red)}
.vp-vol-slider{-webkit-appearance:none;appearance:none;width:64px;height:3px;background:var(--ink3);border-radius:2px;outline:none;cursor:pointer}
.vp-vol-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:12px;height:12px;border-radius:50%;background:var(--cyan);cursor:pointer}
.vp-vol-slider::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:var(--cyan);border:none;cursor:pointer}

.vp-me{display:flex;align-items:center;gap:11px;padding:9px 16px;background:rgba(0,229,255,.04);border-top:1px solid var(--border)}
.vp-me-mic{width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;font-size:16px;transition:all .2s;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.vp-me-mic.on{background:linear-gradient(135deg,var(--cyan),#0099bb);box-shadow:0 2px 12px rgba(0,229,255,.35)}
.vp-me-mic.off{background:var(--ink3);border:1px solid var(--border2)}
.vp-me-mic.muted{background:rgba(255,45,85,.15);border:1px solid rgba(255,45,85,.3)}
.vp-me-label{flex:1;font-family:var(--fm);font-size:11px;color:var(--muted);letter-spacing:.08em}
.vp-vu{width:48px;height:6px;background:var(--ink3);border-radius:3px;overflow:hidden;flex-shrink:0}
.vp-vu-fill{height:100%;width:0%;background:linear-gradient(90deg,var(--green),var(--gold));border-radius:3px;transition:width .05s linear}

.vp-join-row{padding:10px 14px;border-top:1px solid var(--border)}

@media(max-width:380px){.hcards{grid-template-columns:1fr}.pgrid{grid-template-columns:1fr 1fr}}

/* ── TIERLIST ── */
.tl-screen{display:flex;flex-direction:column;gap:12px;padding:16px}
.tl-anime{font-family:var(--fm);font-size:11px;letter-spacing:.15em;color:var(--cyan);text-align:center;text-transform:uppercase}
.tl-title{font-size:22px;font-weight:700;text-align:center;margin-bottom:4px}
.tl-chars{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:8px 0}
.tl-char{background:var(--ink2);border:2px solid var(--border);border-radius:10px;overflow:hidden;cursor:grab;user-select:none;transition:transform .15s,border-color .15s;position:relative}
.tl-char:active{cursor:grabbing;transform:scale(1.05);border-color:var(--gold);z-index:10}
.tl-char.dragging{opacity:.4;border-color:var(--gold)}
.tl-char.drag-over{border-color:var(--cyan);transform:scale(1.03)}
.tl-char img{width:100%;height:90px;object-fit:cover;object-position:top center;display:block}
.tl-char-name{font-size:9px;font-family:var(--fm);padding:4px;text-align:center;line-height:1.2;color:var(--fg)}
.tl-rank{position:absolute;top:4px;left:4px;background:var(--gold);color:#000;font-weight:700;font-size:10px;font-family:var(--fm);width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.tl-rank.r1{background:gold;font-size:11px}
.tl-rank.r2{background:#C0C0C0}
.tl-rank.r3{background:#CD7F32}
.tl-submit-area{margin-top:8px}
.tl-players-grid{display:flex;flex-direction:column;gap:10px}
.tl-player-card{background:var(--ink2);border:1px solid var(--border);border-radius:12px;padding:12px}
.tl-player-name{font-family:var(--fm);font-size:10px;letter-spacing:.12em;color:var(--cyan);margin-bottom:8px}
.tl-mini-list{display:flex;flex-wrap:wrap;gap:4px}
.tl-mini-char{display:flex;align-items:center;gap:4px;background:var(--ink);border-radius:6px;padding:3px 6px;font-size:11px}
.tl-mini-rank{font-family:var(--fm);font-size:9px;color:var(--gold);min-width:14px}
.tl-mini-img{width:20px;height:20px;border-radius:4px;object-fit:cover;object-position:top}
.tl-vote-card{background:var(--ink2);border:2px solid var(--border);border-radius:12px;padding:14px;cursor:pointer;transition:border-color .2s}
.tl-vote-card:hover{border-color:var(--gold)}
.tl-vote-card.voted{border-color:var(--cyan)}
.tl-vote-card.mine{opacity:.5;cursor:not-allowed}
.tl-scores{display:flex;flex-direction:column;gap:6px}
.tl-score-row{display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--ink2);border-radius:8px}
.tl-score-bar{flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden}
.tl-score-fill{height:100%;background:var(--gold);border-radius:3px;transition:width .5s}
</style>
</head>
<body>

<!-- WORD REVEAL CARD -->
<div class="word-reveal-overlay" id="word-reveal-overlay">
  <div class="word-reveal-card" id="word-reveal-card">
    <div class="wrc-bar"></div>
    <div class="wrc-top">
      <span class="wrc-emoji" id="wrc-emoji">🐉</span>
      <div><div class="wrc-author">a dit</div><div class="wrc-name" id="wrc-name">Joueur</div></div>
    </div>
    <div class="wrc-body">
      <div>
        <div class="wrc-said">son mot</div>
        <div class="wrc-word" id="wrc-word">—</div>
      </div>
    </div>
  </div>
</div>

<!-- LOADING -->
<div class="loverlay" id="loading"><div class="l-text" id="l-text">CHARGEMENT</div><div class="l-bar"><div class="l-fill"></div></div></div>

<!-- TOAST -->
<div class="toast" id="toast"></div>

<!-- ELIMINATION OVERLAY -->
<div class="elim-overlay" id="elim-overlay">
  <div class="elim-card">
    <div class="elim-skull">💀</div>
    <div class="elim-name" id="elim-name">Joueur</div>
    <div class="elim-sub" id="elim-sub">a été éliminé</div>
    <div class="elim-continue" id="elim-continue">
      <button class="btn btn-outline" onclick="document.getElementById('elim-overlay').classList.remove('show')">Continuer →</button>
    </div>
  </div>
</div>

<!-- ════ HOME ════ -->
<div id="s-home" class="screen active">
  <div class="hbg"></div><div class="hgrid"></div>
  <div class="hinner">
    <div class="hbadge">● ONLINE MULTIPLAYER</div>
    <h1 class="htitle"><span class="l1">UNDER</span><span class="l2">COVER</span></h1>
    <p class="hsub">— ANIMÉ EDITION —</p>
    <div class="hcards">
      <div class="hcard" onclick="showScreen('s-mode-select')"><span class="hci">🎮</span><div class="hct">CRÉER</div><div class="hcd">Nouvelle partie</div></div>
      <div class="hcard" onclick="showScreen('s-join')"><span class="hci">🔗</span><div class="hct">REJOINDRE</div><div class="hcd">Code de salle</div></div>
    </div>
    <div class="hfooter">
      <button class="btn btn-outline" onclick="showRules()">📜 Règles</button>
    </div>
  </div>
</div>

<!-- ════ CREATE ════ -->
<!-- ════ MODE SELECT ════ -->
<div id="s-mode-select" class="screen">
  <div class="topbar"><div class="tlogo">UNDER<span>COVER</span></div><button class="btn btn-outline" onclick="showScreen('s-home')">← Retour</button></div>
  <div class="wrap">
    <div class="stag">Créer une salle</div>
    <div class="ptitle">CHOISIS UN MODE</div>
    <div class="field"><label>Ton prénom</label><input type="text" id="c-name" placeholder="Ton prénom…" maxlength="20" autocomplete="off"/></div>
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:20px">
      <div onclick="selectMode('undercover')" id="mode-uc" style="background:var(--ink2);border:2px solid var(--border);border-radius:14px;padding:18px 16px;cursor:pointer;transition:border-color .2s">
        <div style="font-size:22px;margin-bottom:6px">🕵️</div>
        <div style="font-weight:700;font-size:16px;margin-bottom:4px">UNDERCOVER</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.5">Trouve l'imposteur avant qu'il ne te grille. Donne des indices, bluff, vote.</div>
      </div>
      <div onclick="selectMode('tierlist')" id="mode-tl" style="background:var(--ink2);border:2px solid var(--border);border-radius:14px;padding:18px 16px;cursor:pointer;transition:border-color .2s">
        <div style="font-size:22px;margin-bottom:6px">🏆</div>
        <div style="font-weight:700;font-size:16px;margin-bottom:4px">TIERLIST</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.5">Classe 10 persos d'un animé aléatoire. Le meilleur classement gagne le vote. Premier à 10 points gagne.</div>
      </div>
      <div onclick="selectMode('freetl')" id="mode-freetl" style="background:var(--ink2);border:2px solid var(--border);border-radius:14px;padding:18px 16px;cursor:pointer;transition:border-color .2s">
        <div style="font-size:22px;margin-bottom:6px">🌀</div>
        <div style="font-weight:700;font-size:16px;margin-bottom:4px">FREE TIERLIST</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.5">10 persos random de tous les animés. Classe, révèle, débat. Enchaîne les rounds sans retourner au lobby.</div>
      </div>
      <div onclick="selectMode('music')" id="mode-music" style="background:var(--ink2);border:2px solid var(--border);border-radius:14px;padding:18px 16px;cursor:pointer;transition:border-color .2s">
        <div style="font-size:22px;margin-bottom:6px">🎵</div>
        <div style="font-weight:700;font-size:16px;margin-bottom:4px">MUSIC RATING</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.5">Écoute des openings/endings et note-les sur 10. Compare tes goûts avec les autres et débat.</div>
      </div>
    </div>
    <button class="btn btn-red btn-full" id="mode-confirm-btn" style="margin-top:20px;opacity:.4;pointer-events:none" onclick="confirmModeAndCreate()">CRÉER LA SALLE →</button>
  </div>
</div>

<!-- ════ FREE TIERLIST RANKING ════ -->
<div id="s-freetl-ranking" class="screen" style="overflow-y:auto">
  <div class="tl-screen">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <div class="tl-anime" id="freetl-round-label"></div>
      <div id="freetl-submitted-count" style="font-family:var(--fm);font-size:10px;color:var(--muted)"></div>
    </div>
    <div class="tl-title">Classe ces 10 persos !</div>
    <div style="font-size:12px;color:var(--muted);text-align:center;margin-bottom:8px">Glisse pour réordonner — #1 = ton préféré</div>
    <div class="tl-chars" id="freetl-chars-grid"></div>
    <div style="margin-top:12px">
      <div id="freetl-waiting-msg" style="text-align:center;font-family:var(--fm);font-size:11px;color:var(--cyan);display:none">✅ Envoyé — en attente des autres…</div>
      <button class="btn btn-gold btn-full" id="freetl-submit-btn" onclick="submitFreeTierlist()">VALIDER →</button>
    </div>
  </div>
</div>

<!-- ════ FREE TIERLIST REVEAL ════ -->
<div id="s-freetl-reveal" class="screen" style="overflow-y:auto">
  <div class="tl-screen">
    <div class="tl-anime" id="freetl-reveal-round"></div>
    <div class="tl-title">Les classements !</div>
    <div class="tl-players-grid" id="freetl-reveal-grid"></div>
    <div style="margin-top:16px;display:flex;gap:8px">
      <button class="btn btn-gold btn-full" id="freetl-next-btn" onclick="socket.emit('freetl:next')" style="display:none">ROUND SUIVANT →</button>
      <button class="btn btn-outline" onclick="socket.emit('freetl:reset')" style="flex:1">LOBBY</button>
    </div>
  </div>
</div>

<!-- ════ MUSIC OPTIONS ════ -->
<div id="s-music-options" class="screen">
  <div class="topbar"><div class="tlogo">UNDER<span>COVER</span></div><button class="btn btn-outline" onclick="showScreen('s-mode-select')">← Retour</button></div>
  <div class="wrap">
    <div class="stag">Mode Music Rating</div>
    <div class="ptitle">OPTIONS</div>
    <div class="field">
      <label>Type de musiques</label>
      <div class="chips" id="music-type-chips">
        <button class="chip on" data-t="both">Tout</button>
        <button class="chip" data-t="OP">Openings</button>
        <button class="chip" data-t="ED">Endings</button>
      </div>
    </div>
    <div class="field" style="margin-top:16px">
      <label>Nombre de musiques</label>
      <div class="chips" id="music-count-chips">
        <button class="chip" data-c="3">3</button>
        <button class="chip" data-c="5">5</button>
        <button class="chip on" data-c="8">8</button>
        <button class="chip" data-c="10">10</button>
        <button class="chip" data-c="15">15</button>
      </div>
    </div>
    <button class="btn btn-gold btn-full" style="margin-top:24px" onclick="createRoomMusic()">CRÉER LA SALLE →</button>
  </div>
</div>

<!-- ════ MUSIC PLAYER SCREEN ════ -->
<div id="s-music-player" class="screen" style="overflow-y:auto">
  <div class="topbar">
    <div class="tlogo">UNDER<span>COVER</span></div>
    <div style="font-family:var(--fm);font-size:10px;color:var(--muted)" id="mp-progress"></div>
  </div>
  <div class="wrap" style="padding-top:8px">
    <!-- Track info -->
    <div style="background:var(--ink2);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px;text-align:center">
      <div style="font-family:var(--fm);font-size:9px;letter-spacing:.15em;color:var(--cyan);margin-bottom:6px" id="mp-type-label"></div>
      <div style="font-size:20px;font-weight:700;margin-bottom:4px" id="mp-song-title"></div>
      <div style="font-size:13px;color:var(--muted)" id="mp-anime-name"></div>
    </div>
    <!-- Audio player -->
    <div style="background:var(--ink2);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <button onclick="togglePlay()" id="mp-play-btn" style="width:48px;height:48px;border-radius:50%;background:var(--gold);color:#000;border:none;font-size:20px;cursor:pointer;flex-shrink:0">▶</button>
        <div style="flex:1">
          <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;cursor:pointer" onclick="seekAudio(event)" id="mp-bar-wrap">
            <div id="mp-bar" style="height:100%;background:var(--gold);width:0%;transition:width .2s;border-radius:2px"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;font-family:var(--fm);font-size:9px;color:var(--muted)">
            <span id="mp-time-cur">0:00</span>
            <span id="mp-time-tot">0:00</span>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:center;margin-bottom:10px">
        <button onclick="playSegment('intro')" class="btn btn-outline" style="font-size:11px;padding:6px 12px">▶ Début (10s)</button>
        <button onclick="playSegment('chorus')" class="btn btn-outline" style="font-size:11px;padding:6px 12px">▶ Refrain (1min)</button>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:14px">🔈</span>
        <input type="range" id="mp-volume" min="0" max="1" step="0.05" value="0.8"
          style="flex:1;accent-color:var(--gold)"
          oninput="if(_musicAudio)_musicAudio.volume=this.value">
        <span style="font-size:14px">🔊</span>
      </div>
    </div>
    <!-- Rating -->
    <div style="background:var(--ink2);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px">
      <div style="font-family:var(--fm);font-size:10px;letter-spacing:.12em;color:var(--muted);margin-bottom:10px">TA NOTE</div>
      <div style="display:flex;align-items:center;gap:12px">
        <input type="range" id="mp-rating-slider" min="0" max="10" step="0.5" value="5"
          style="flex:1;accent-color:var(--gold)"
          oninput="updateMyRating(this.value)">
        <div style="font-size:28px;font-weight:700;font-family:var(--fm);min-width:40px;color:var(--gold)" id="mp-rating-val">5.0</div>
      </div>
      <div style="display:flex;justify-content:space-between;font-family:var(--fm);font-size:9px;color:var(--muted);margin-top:2px">
        <span>0 — nul</span><span>5 — bof</span><span>10 — chef-d'œuvre</span>
      </div>
    </div>
    <!-- Live ratings from others -->
    <div style="background:var(--ink2);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px">
      <div style="font-family:var(--fm);font-size:10px;letter-spacing:.12em;color:var(--muted);margin-bottom:10px">NOTES EN DIRECT</div>
      <div id="mp-live-ratings"></div>
    </div>
    <!-- Host next button -->
    <div id="mp-host-controls" style="display:none">
      <button class="btn btn-gold btn-full" onclick="socket.emit('music:next')">MUSIQUE SUIVANTE →</button>
    </div>
    <button class="btn btn-outline btn-full" style="margin-top:8px" onclick="socket.emit('music:reset')">QUITTER</button>
  </div>
</div>

<!-- ════ MUSIC DONE SCREEN ════ -->
<div id="s-music-done" class="screen" style="overflow-y:auto">
  <div class="wrap" style="text-align:center;padding-top:40px">
    <div style="font-size:40px;margin-bottom:12px">🎵</div>
    <div class="ptitle" style="margin-bottom:8px">Session terminée !</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:24px">Récap de vos notes</div>
    <div id="music-recap" style="text-align:left"></div>
    <button class="btn btn-gold btn-full" style="margin-top:20px" onclick="socket.emit('music:reset')">RETOUR LOBBY</button>
  </div>
</div>

<!-- ════ CREATE (undercover options) ════ -->
<div id="s-create" class="screen">
  <div class="topbar"><div class="tlogo">UNDER<span>COVER</span></div><button class="btn btn-outline" onclick="showScreen('s-mode-select')">← Retour</button></div>
  <div class="wrap">
    <div class="stag">Mode Undercover</div>
    <div class="ptitle">OPTIONS</div>
    <div class="field"><label>Genre d'animé</label>
      <div class="chips" id="chips">
        <button class="chip on" data-g="shonen">Shōnen</button>
        <button class="chip" data-g="fantasy">Fantasy</button>
        <button class="chip" data-g="action">Action</button>
        <button class="chip" data-g="romance">Romance</button>
        <button class="chip" data-g="sports">Sports</button>
        <button class="chip" data-g="mix">Mix total</button>
      </div>
    </div>
    <div style="margin-top:18px;margin-bottom:6px">
      <div class="stag">Options</div>
      <div class="toggle-row">
        <div><div class="toggle-label">Mr. White</div><div class="toggle-sub">Rôle caché (5+ joueurs)</div></div>
        <label class="toggle"><input type="checkbox" id="opt-mrw" checked><span class="toggle-slider"></span></label>
      </div>
      <div class="toggle-row">
        <div><div class="toggle-label">Double Undercover</div><div class="toggle-sub">2 imposteurs (6+ joueurs)</div></div>
        <label class="toggle"><input type="checkbox" id="opt-uc2"><span class="toggle-slider"></span></label>
      </div>
      <div class="toggle-row">
        <div><div class="toggle-label">Timer (45s / 60s)</div><div class="toggle-sub">Pression sur chaque tour</div></div>
        <label class="toggle"><input type="checkbox" id="opt-timer" checked><span class="toggle-slider"></span></label>
      </div>
    </div>
    <button class="btn btn-red btn-full" style="margin-top:18px" onclick="createRoom()">CRÉER LA SALLE →</button>
  </div>
</div>

<!-- ════ JOIN ════ -->
<div id="s-join" class="screen">
  <div class="topbar"><div class="tlogo">UNDER<span>COVER</span></div><button class="btn btn-outline" onclick="showScreen('s-home')">← Retour</button></div>
  <div class="wrap">
    <div class="stag">Joueur</div>
    <div class="ptitle">REJOINDRE</div>
    <div class="field"><label>Ton prénom</label><input type="text" id="j-name" placeholder="Ton prénom…" maxlength="20" autocomplete="off"/></div>
    <div class="field"><label>Code de la salle</label><input type="text" class="code-input" id="j-code" placeholder="AB7K" maxlength="4" autocomplete="off" oninput="this.value=this.value.toUpperCase()"/></div>
    <button class="btn btn-red btn-full" onclick="joinRoom()">REJOINDRE →</button>
  </div>
</div>

<!-- ════ LOBBY ════ -->
<div id="s-lobby" class="screen">
  <div class="topbar"><div class="tlogo">UNDER<span>COVER</span></div><div class="tcode" id="l-codepill">----</div></div>
  <div class="wrap">
    <div class="stag" id="l-tag">Salle d'attente</div>
    <div class="ptitle" id="l-title">EN ATTENTE…</div>
    <div class="code-box"><div><div class="cb-label">Code à partager</div><div class="cb-val" id="l-code">----</div></div><button class="btn btn-outline" onclick="copyCode()">COPIER</button></div>
    <div id="scores-section" style="display:none">
      <div class="scores-box"><div class="scores-title">🏆 SCORES</div><div id="scores-list"></div></div>
    </div>
    <div class="stag" style="margin-bottom:9px">Joueurs</div>
    <div id="l-players"></div>
    <div id="l-host-ctrl" style="display:none;margin-top:16px">
      <div class="info-box">Minimum 3 joueurs pour lancer.</div>
      <button class="btn btn-outline btn-full" id="l-add-bot" onclick="addBot()" style="margin-bottom:8px;font-size:13px">🤖 AJOUTER UN BOT IA</button>
      <div id="l-mode-badge" style="text-align:center;font-family:var(--fm);font-size:10px;letter-spacing:.12em;color:var(--muted);margin-bottom:6px"></div>
      <button class="btn btn-gold btn-full" id="l-start" onclick="hostStartAuto()" disabled>LANCER →</button>

    </div>
    <div id="l-guest-wait" style="display:none;margin-top:16px;font-family:var(--fm);font-size:12px;color:var(--muted);text-align:center;letter-spacing:.1em">En attente que l'hôte lance…</div>
    <div class="btn-row" style="margin-top:20px"><button class="btn btn-outline" onclick="leaveRoom()">Quitter</button></div>
  </div>
</div>

<!-- ════ REVEAL ════ -->
<div id="s-reveal" class="screen">
  <div class="rv-label" id="rv-name-label">JOUEUR</div>
  <div class="card-scene" onclick="flipCard()">
    <div class="card-3d" id="the-card">
      <div class="card-face c-back"><div class="c-back-pat"></div><div class="c-back-bdr"></div><div class="c-back-logo">UC</div><div class="c-back-tap">APPUIE POUR VOIR</div></div>
      <div class="card-face c-front" id="card-front">
        <div class="cf-header"><span class="cf-role">Ta carte</span><span class="cf-num">#UC</span></div>
        <div class="cf-img" id="cf-img"><div class="cf-img-ph">🎭</div></div>
        <div class="cf-img-ov"></div>
        <div class="cf-body"><div class="cf-name" id="cf-name">—</div><div class="cf-div"></div><div class="cf-hint" id="cf-hint">Décris ce perso sans le nommer !</div><div class="cf-stamp"><span class="cf-stamp-t">UNDERCOVER</span></div></div>
      </div>
    </div>
  </div>
  <div class="rv-tap" id="rv-tap">[ APPUIE SUR LA CARTE ]</div>
  <div id="rv-done"><button class="btn btn-red" onclick="doneReading()">J'AI LU → CACHER</button></div>
</div>

<!-- ════ WAITING ════ -->
<div id="s-waiting" class="screen">
  <div class="wait-icon">⏳</div>
  <div class="wait-title">EN ATTENTE</div>
  <div class="wait-sub">Tous les joueurs lisent leur carte…</div>
  <div class="rlist" id="rlist"></div>
</div>

<!-- ════ PLAYING ════ -->
<div id="s-playing" class="screen">
  <div class="topbar"><div class="tlogo">UNDER<span>COVER</span></div><div class="tcode" id="g-codepill">----</div></div>
  <div class="wrap">
    <div class="round-hdr"><span class="round-num">TOUR <span id="g-round">1</span></span><span class="alive-cnt"><span id="g-alive">?</span> en vie</span></div>
    <!-- TURN ORDER BANNER -->
    <div id="turn-order-bar" style="display:none;background:var(--ink2);border:1px solid var(--border);border-left:3px solid var(--cyan);padding:10px 14px;margin-bottom:12px;font-family:var(--fm);font-size:11px;color:var(--muted);line-height:1.8">
      <div style="font-size:9px;letter-spacing:.2em;color:var(--cyan);text-transform:uppercase;margin-bottom:4px">Ordre de passage</div>
      <div id="turn-order-list" style="display:flex;flex-wrap:wrap;gap:6px 4px"></div>
    </div>
    <div id="timer-wrap" style="display:none"><div class="timer-bar"><div class="timer-fill" id="timer-fill"></div></div><div class="timer-label" id="timer-label"></div></div>
    <div class="my-word" id="my-word" style="display:none"><div><div class="mw-l">Ton personnage</div><div class="mw-v" id="mw-v">—</div></div><div id="mw-role" style="font-size:20px"></div></div>
    <div class="pgrid" id="pgrid"></div>

    <!-- WORDS BOX -->
    <div class="gbox" id="words-box">
      <div class="pbadge pbw">Phase 1 — Description</div>
      <div class="gbox-title">DÉCRIS TON PERSO</div>
      <div class="info-box" style="margin-bottom:12px">1 mot ou indice, sans jamais dire le nom. Si tu le dis → éliminé automatiquement !</div>
      <div class="winput-row" id="winput-row">
        <input type="text" id="word-input" placeholder="Ton indice…" maxlength="40" onkeydown="if(event.key==='Enter')submitWord()" autocomplete="off"/>
        <button class="btn btn-green" onclick="submitWord()">OK</button>
      </div>
      <div class="sub-notice" id="sub-notice"><span>✓</span> Envoyé — en attente des autres…</div>
      <div class="wlist" id="words-list"></div>
      <div class="hist-section" id="hist-section"></div>
      <!-- ACCUSATION -->
      <div id="accuse-section" style="display:none;margin-top:12px;border-top:1px solid var(--border);padding-top:12px">
        <div style="font-family:var(--fm);font-size:9px;letter-spacing:.2em;color:var(--red);text-transform:uppercase;margin-bottom:8px">👉 Pointer du doigt</div>
        <div id="accuse-btns" style="display:flex;flex-wrap:wrap;gap:6px"></div>
      </div>
    </div>

    <!-- VOTE BOX -->
    <div class="gbox" id="vote-box" style="display:none">
      <div class="pbadge pbv">Phase 2 — Vote</div>
      <div class="gbox-title">ÉLIMINATION</div>
      <div class="wsummary"><div class="ws-l">Mots du tour</div><div id="ws-content"></div></div>
      <div class="tie-box" id="tie-box" style="display:none"><div class="tie-title">⚡ ÉGALITÉ</div><div id="tie-content"></div></div>
      <div class="host-tag" id="host-note"></div>
      <div id="vbtns"></div>
    </div>

    <!-- MR WHITE -->
    <div class="mrw-box" id="mrw-box">
      <div class="mrw-t">🎯 MR. WHITE</div>
      <div class="mrw-s">L'Undercover est éliminé. Devine le personnage civil pour gagner !</div>
      <div class="winput-row"><input type="text" id="mrw-input" placeholder="Nom du perso…" maxlength="40" onkeydown="if(event.key==='Enter')submitMrwGuess()"/><button class="btn btn-gold" onclick="submitMrwGuess()">DEVINER</button></div>
    </div>

    <div class="btn-row"><button class="btn btn-outline" onclick="leaveRoom()">Quitter</button></div>
  </div>
</div>

<!-- ════ SPECTATOR ════ -->
<div id="s-spectator" class="screen">
  <div class="topbar"><div class="tlogo">UNDER<span>COVER</span></div><div class="tcode" id="sp-codepill">----</div></div>
  <div class="wrap">
    <div class="stag">Mode observateur</div>
    <div class="ptitle">👁 EN OBSERVATION</div>
    <div class="info-box">Tu observes la partie sans y participer. Les autres joueurs ne savent pas que tu regardes.</div>
    <div class="gbox" id="sp-words-box" style="display:none">
      <div class="pbadge pbw">Mots du tour en cours</div>
      <div class="wlist" id="sp-words-list"></div>
    </div>
    <div class="pgrid" id="sp-pgrid"></div>
    <div class="gbox" id="sp-hist"><div class="hist-section" id="sp-hist-content"></div></div>
    <div class="btn-row"><button class="btn btn-outline" onclick="leaveRoom()">Quitter</button></div>
  </div>
</div>

<!-- ════ SPECTATOR OFFER ════ -->
<div id="s-specoffer" class="screen">
  <div class="topbar"><div class="tlogo">UNDER<span>COVER</span></div></div>
  <div class="wrap" style="text-align:center;padding-top:60px">
    <div style="font-size:52px;margin-bottom:20px">🎮</div>
    <div class="stag">Partie en cours</div>
    <div class="ptitle">REJOINDRE EN SPECTATEUR ?</div>
    <div class="info-box" style="text-align:left;margin-bottom:24px">Une partie est déjà en cours dans cette salle. Tu peux observer sans participer — la partie continue normalement.</div>
    <div class="btn-row" style="justify-content:center">
      <button class="btn btn-red" id="spec-yes-btn">OBSERVER 👁</button>
      <button class="btn btn-outline" onclick="showScreen('s-join')">← Retour</button>
    </div>
  </div>
</div>


<!-- ════ VOICE PANEL ════ -->
<button id="voice-btn" class="off" title="Vocal" onclick="toggleVoicePanel()">🎙️</button>

<div id="voice-panel">
  <div class="vp-head">
    <div class="vp-title"><div class="vp-dot" id="vp-dot"></div>VOCAL</div>
    <button class="vp-close" onclick="toggleVoicePanel()">✕</button>
  </div>
  <div class="vp-device">
    <label>Microphone</label>
    <select id="vp-mic-select" onchange="changeMic(this.value)"><option value="">— sélectionner —</option></select>
  </div>
  <div class="vp-peers" id="vp-peers"></div>
  <div class="vp-me">
    <button class="vp-me-mic off" id="vp-me-mic" onclick="toggleMyMic()" title="Muet / Son">🎙️</button>
    <div class="vp-me-label" id="vp-me-label">Micro désactivé</div>
    <div class="vp-vu"><div class="vp-vu-fill" id="vp-vu-fill"></div></div>
  </div>
  <div class="vp-join-row">
    <button class="btn btn-outline btn-full" id="vp-join-btn" onclick="joinVoice()" style="font-size:12px;padding:9px">🎙 REJOINDRE LE VOCAL</button>
  </div>
</div>

<!-- ════ COUNTDOWN ════ -->
<!-- TIERLIST RANKING SCREEN -->
<div id="s-tierlist-ranking" class="screen" style="overflow-y:auto">
  <div class="tl-screen">
    <div class="tl-anime" id="tl-anime-label"></div>
    <div class="tl-title" id="tl-anime-title"></div>
    <div style="font-size:12px;color:var(--muted);text-align:center">Glisse les persos pour faire ton top 10 — #1 = ton préféré</div>
    <div class="tl-chars" id="tl-chars-grid"></div>
    <div class="tl-submit-area">
      <div id="tl-waiting-msg" style="text-align:center;font-family:var(--fm);font-size:11px;color:var(--cyan);display:none">✅ Classement envoyé — en attente des autres…</div>
      <button class="btn btn-gold btn-full" id="tl-submit-btn" onclick="submitTierlist()">VALIDER MON TOP 10 →</button>
    </div>
    <div id="tl-submitted-list" style="font-size:11px;color:var(--muted);text-align:center;font-family:var(--fm)"></div>
  </div>
</div>

<!-- TIERLIST REVEAL SCREEN -->
<div id="s-tierlist-reveal" class="screen" style="overflow-y:auto">
  <div class="tl-screen">
    <div class="tl-anime" id="tl-reveal-label"></div>
    <div class="tl-title">Les classements !</div>
    <div class="tl-players-grid" id="tl-reveal-grid"></div>
    <div style="margin-top:12px" id="tl-open-vote-area">
      <button class="btn btn-gold btn-full" id="tl-vote-btn" onclick="socket.emit('tierlist:openVote')" style="display:none">LANCER LE VOTE →</button>
    </div>
  </div>
</div>

<!-- TIERLIST VOTE SCREEN -->
<div id="s-tierlist-vote" class="screen" style="overflow-y:auto">
  <div class="tl-screen">
    <div class="tl-title">Vote pour le meilleur classement !</div>
    <div style="font-size:12px;color:var(--muted);text-align:center;margin-bottom:8px">Tu ne peux pas voter pour le tien</div>
    <div class="tl-players-grid" id="tl-vote-grid"></div>
  </div>
</div>

<!-- TIERLIST RESULT SCREEN -->
<div id="s-tierlist-result" class="screen" style="overflow-y:auto">
  <div class="tl-screen">
    <div class="tl-title" id="tl-result-winner"></div>
    <div class="tl-scores" id="tl-scores-list"></div>
    <div style="margin-top:16px;display:flex;gap:8px">
      <button class="btn btn-gold btn-full" id="tl-next-btn" onclick="socket.emit('tierlist:next')" style="display:none">ROUND SUIVANT →</button>
      <button class="btn btn-outline btn-full" onclick="socket.emit('tierlist:reset')">RETOUR LOBBY</button>
    </div>
  </div>
</div>

<div id="s-countdown" class="screen" style="justify-content:center;background:var(--ink)">
  <div style="text-align:center;position:relative;z-index:2">
    <div style="font-family:var(--fd);font-size:11px;letter-spacing:.3em;color:var(--muted);margin-bottom:20px;font-family:var(--fm)">DÉBUT DE LA PARTIE</div>
    <div id="cd-number" style="font-family:var(--fd);font-size:clamp(120px,30vw,200px);line-height:1;background:linear-gradient(135deg,var(--red),var(--gold));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:cdPulse .9s ease-in-out infinite">3</div>
    <div style="font-family:var(--fm);font-size:12px;letter-spacing:.2em;color:var(--muted);margin-top:16px;animation:blink 1s infinite">PRÉPARE-TOI…</div>
  </div>
</div>

<!-- ════ RESULT ════ -->
<div id="s-result" class="screen">
  <div id="res-glow"></div>
  <div class="res-inner">
    <div class="res-tag">RÉSULTAT</div>
    <div class="res-title" id="res-title">FIN</div>
    <div class="res-div"></div>
    <div class="res-sub" id="res-sub"></div>
    <div class="res-card" id="res-details"></div>
    <div class="res-scores" id="res-scores" style="display:none"><div class="rs-title">🏆 TABLEAU DES SCORES</div><div id="rs-rows"></div></div>
    <div class="btn-row" style="justify-content:center">
      <button class="btn btn-red" id="res-replay" style="display:none" onclick="hostReset()">REJOUER →</button>
      <button class="btn btn-outline" onclick="shareScore()">📤 Partager</button>
      <button class="btn btn-outline" onclick="leaveRoom()">MENU</button>
    </div>
  </div>
</div>

<script>
const SERVER_URL = 'https://undercover-backend-4st4.onrender.com';

// ── ANTI-SLEEP PING ──
setInterval(() => fetch(SERVER_URL + '/ping').catch(()=>{}), 8*60*1000);

// ── AUDIO ──
const AC = window.AudioContext ? new AudioContext() : null;
function beep(f,d,v=.15,t='sine'){if(!AC)return;try{const o=AC.createOscillator(),g=AC.createGain();o.connect(g);g.connect(AC.destination);o.frequency.value=f;o.type=t;g.gain.setValueAtTime(v,AC.currentTime);g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+d);o.start();o.stop(AC.currentTime+d);}catch{}}
function soundOk(){beep(880,.12);setTimeout(()=>beep(1100,.12),100);}
function soundError(){beep(220,.3,.2,'sawtooth');}
function soundElim(){beep(440,.1);setTimeout(()=>beep(330,.1),120);setTimeout(()=>beep(220,.4),240);}
function soundTimer(){beep(1200,.06,.08);}
function soundVictory(){[523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,.3,.15),i*120));}
function soundCountdown(n){beep(n>0?660:880,n>0?.15:.4,.2);}
function soundAccuse(){beep(550,.08);setTimeout(()=>beep(440,.15),80);}

// ── VIBRATION ──
function vibe(p){if(navigator.vibrate)navigator.vibrate(p);}
function vibeElim(){vibe([80,40,80,40,200]);}
function vibeOk(){vibe(40);}
function vibeError(){vibe([100,50,100]);}

// ── STATE ──
let socket, _lastRoom=null, _myVote=null, _isSpectator=false, _pendingSpec=null, timerInterval=null, _currentTurnPlayer=null;
let S={name:null,code:null,isHost:false,myAssignment:null,cardFlipped:false,genre:'shonen',subPhase:'words'};
const EMOJIS=['🐉','⚔️','🌊','🔥','⚡','🌙','🎯','🗡️','🛡️','✨','👁️','🐺','🌸','💫','🦊','🗿','🌀','🦋','🔮','🎪'];

// ── SOCKET ──
function initSocket(){
  if(socket?.connected)return;
  socket=io(SERVER_URL,{transports:['websocket','polling']});
  socket.on('connect',()=>{
    const s=sessionStorage.getItem('uc');
    // Only reconnect if we have a session AND we're not currently in a fresh join flow
    if(s && S.code){
      try{socket.emit('room:reconnect',JSON.parse(s));}catch{}
    } else if(s && !S.name){
      // Page reload — try to reconnect
      try{socket.emit('room:reconnect',JSON.parse(s));}catch{}
    }
  });
  socket.on('disconnect',()=>toast('Connexion perdue…','err'));
  socket.on('error', msg => {
    soundError(); vibeError(); setLoading(false);
    if(msg && msg.includes('Session introuvable')) {
      sessionStorage.removeItem('uc');
      resetState();
      showScreen('s-home');
      setTimeout(()=>toast('⚠️ Session expirée, relance une partie !','err'),300);
    } else {
      toast(msg||'Erreur','err');
    }
  });

  socket.on('loading',on=>setLoading(on));
  socket.on('room:joined',({code,name,isHost,isSpectator})=>{S.name=name;S.code=code;S.isHost=isHost;_isSpectator=isSpectator||false;sessionStorage.setItem('uc',JSON.stringify({name,code}));setLoading(false);});
  socket.on('room:promoted',()=>{S.isHost=true;toast("Tu es maintenant l'hôte !",'ok');});
  socket.on('room:update',room=>handleRoomUpdate(room));
  socket.on('spectator:offer',({code,name})=>{_pendingSpec={code,name};setLoading(false);document.getElementById('spec-yes-btn').onclick=()=>joinAsSpectator();showScreen('s-specoffer');});
  socket.on('spectator:joined',({message})=>{toast(message,'ok');showScreen('s-spectator');document.getElementById('sp-codepill').textContent=S.code;});
  socket.on('your:assignment',a=>{S.myAssignment=a;buildCardFront(a);});
  socket.on('turn:next',({player})=>{
    _currentTurnPlayer = player;
    const isMe = player === S.name;
    if(isMe){
      toast('🎯 C\'est ton tour !', 'ok');
      soundOk(); vibe([60,30,60]);
    } else {
      toast(`⏳ Tour de ${player}…`);
    }
    if(_lastRoom) renderPlaying(_lastRoom);
  });
  socket.on('words:all_submitted',({round})=>{
    clearClientTimer();
    toast(`Tour ${round} — mots soumis !`,'ok');soundOk();vibeOk();
  });
  socket.on('mrwhite:your_turn',()=>{document.getElementById('mrw-box').classList.add('show');toast("À toi Mr. White — devine le perso civil !",'warn');vibe([100,50,100,50,100]);});
  socket.on('player:eliminated',({name})=>{showElimOverlay(name);soundElim();vibeElim();});
  socket.on('player:accused',({accuser,target})=>{
    toast(`👉 ${accuser} pointe ${target} du doigt !`,'warn');soundAccuse();vibeOk();
    setTimeout(()=>{document.querySelectorAll('.pcard').forEach(el=>{if(el.querySelector('.pc-n')?.textContent===target){el.style.borderColor='var(--red)';el.style.background='rgba(255,45,85,.12)';setTimeout(()=>{el.style.borderColor='';el.style.background='';},2000);}});},100);
  });
  socket.on('vote:tie',({tied,tally})=>{
    const tb=document.getElementById('tie-box'),tc=document.getElementById('tie-content');
    tb.style.display='block';
    if(S.isHost){tc.innerHTML=`<p style="font-family:var(--fm);font-size:11px;color:var(--muted);margin-bottom:10px">Égalité — tu décides :</p>`+tied.map(n=>`<button class="btn btn-red-sm" style="margin:4px" onclick="socket.emit('vote:tiebreak',{target:'${n}'})">Éliminer ${n}</button>`).join('');}
    else{tc.innerHTML=`<p style="font-family:var(--fm);font-size:11px;color:var(--muted)">Égalité entre : ${tied.join(', ')}. L'hôte décide…</p>`;}
    vibe([60,30,60]);
  });
  socket.on('vote:restore',({target})=>{_myVote=target;if(_lastRoom)renderPlaying(_lastRoom);});
  socket.on('word:revealed',({player, word})=>{
    showWordReveal(player, word);
  });
  socket.on('word:blocked',({word})=>{soundError();vibeError();const inp=document.getElementById('word-input');inp.classList.add('blocked');setTimeout(()=>inp.classList.remove('blocked'),600);toast(`🚫 "${word}" contient ton perso — tu es éliminé !`,'err');});
  socket.on('game:countdown',n=>{
    if(n>0){showScreen('s-countdown');const el=document.getElementById('cd-number');el.textContent=n;el.style.animation='none';void el.offsetWidth;el.style.animation='cdPulse .9s ease-in-out infinite';}
    soundCountdown(n);vibe(n>0?60:200);
  });
  socket.on('kicked',msg=>{toast(msg,'err');soundError();vibeError();sessionStorage.removeItem('uc');resetState();setTimeout(()=>showScreen('s-home'),1600);});
  socket.on('toast',msg=>toast(msg));
  // WebRTC voice signaling
  voiceBindSocket();
}

// ── ROOM UPDATE ──
function handleRoomUpdate(room){
  _lastRoom=room;
  const cur=document.querySelector('.screen.active')?.id;
  const gameScreens=['s-lobby','s-reveal','s-waiting','s-playing','s-spectator','s-result'];
  if(gameScreens.includes(cur)) voiceShowBtn(true);
  if(_isSpectator){renderSpectator(room);if(cur!=='s-spectator')showScreen('s-spectator');return;}
  if(room.phase==='tierlist'){
    _tlVoted=!!room.tierlist?.votes?.[S.name];
    handleTierlistUpdate(room);
  } else if(room.phase==='freetl'){
    if(!room.freetl) return;
    const ftCharsKey = room.freetl.characters.map(c=>c.name).join(',');
    if(room.freetl.phase==='ranking'&&_ftlRanking.join(',')!==ftCharsKey){
      _ftlRanking=room.freetl.characters.map(c=>c.name);
      _ftlSubmitted=false;
    } else if(room.freetl.phase==='ranking'){
      _ftlSubmitted=!!room.freetl.submissions[S.name];
    }
    handleFreeTlUpdate(room);
  } else if(room.phase==='music'){
    handleMusicUpdate(room);
  } else if(room.phase==='lobby'){
    // Reset tierlist state when returning to lobby
    _tlSubmitted=false; _tlVoted=false; _tlRanking=[];
    renderLobby(room);if(cur!=='s-lobby')showScreen('s-lobby');clearClientTimer();
  }
  if(room.phase==='reveal'){
    clearClientTimer();
    if(cur!=='s-reveal'&&cur!=='s-waiting'){S.cardFlipped=false;S.subPhase='words';_myVote=null;document.getElementById('the-card').classList.remove('flipped');document.getElementById('rv-done').style.display='none';document.getElementById('rv-tap').style.display='block';document.getElementById('rv-name-label').textContent=(S.name||'').toUpperCase();showScreen('s-reveal');}
    if(cur==='s-waiting')renderReadyList(room.players);
  }
  if(room.phase==='playing'){
    const wasInPlay = cur==='s-playing';
    if(cur==='s-waiting'||cur==='s-reveal'||cur==='s-countdown'){S.subPhase='words';_myVote=null;document.getElementById('sub-notice').classList.remove('show');document.getElementById('winput-row').style.display='flex';document.getElementById('word-input').value='';document.getElementById('tie-box').style.display='none';document.getElementById('mrw-box').classList.remove('show');showScreen('s-playing');document.getElementById('g-codepill').textContent=S.code;}
    // Detect round change while already playing (e.g. round 1→2 auto-advance)
    if(wasInPlay && _lastRoom && room.round !== _lastRoom.round){
      _myVote=null; _currentTurnPlayer=null;
      document.getElementById('sub-notice').classList.remove('show');
      document.getElementById('winput-row').style.display='flex';
      document.getElementById('word-input').value='';
      document.getElementById('tie-box').style.display='none';
    }
    // Sync turn player from room state (for reconnects)
    if(room.turnOrder && room.currentTurnIndex !== undefined){
      const alive = room.turnOrder.filter(n => room.players[n] && !room.players[n].eliminated && room.players[n].connected);
      _currentTurnPlayer = alive[room.currentTurnIndex % Math.max(alive.length,1)] || null;
    }
    if(room.subPhase)S.subPhase=room.subPhase;
    renderPlaying(room);
    if(room.timerEnd)startClientTimer(room.timerEnd,room.timerPhase);
  }
  if(room.phase==='result'){clearClientTimer();showScreen('s-result');renderResult(room);}
  if(Voice.panelOpen) voiceRenderPanel();
}

// ── SPECTATOR ──
function renderSpectator(room){
  const players=room.players||{};
  const names=Object.keys(players).filter(n=>!players[n].isSpectator);
  const alive=names.filter(n=>!players[n].eliminated);
  document.getElementById('sp-pgrid').innerHTML=names.map((n,i)=>`<div class="pcard ${players[n].eliminated?'dead':''}"><span class="pc-em">${EMOJIS[i%EMOJIS.length]}</span><div><div class="pc-n">${n}</div><div class="pc-s">${players[n].eliminated?'☠ éliminé':'en vie'}</div></div></div>`).join('');
  const rk=`round${room.round}`;const wordsNow=room.words?.[rk]||{};
  const wb=document.getElementById('sp-words-box');
  if(Object.keys(wordsNow).length>0){wb.style.display='block';document.getElementById('sp-words-list').innerHTML=alive.map(n=>`<div class="wentry"><span class="we-auth">${EMOJIS[names.indexOf(n)%EMOJIS.length]} ${n}</span>${wordsNow[n]?`<span class="we-word">${wordsNow[n]}</span>`:`<span class="we-pend">écrit…</span>`}</div>`).join('');}
  else{wb.style.display='none';}
  let hist='';for(let r=1;r<room.round;r++){const rw=room.words?.[`round${r}`]||{};const parts=names.filter(n=>rw[n]).map(n=>`${n}: <b>${rw[n]}</b>`).join(' · ');if(parts)hist+=`<div class="hist-row"><span class="hist-round">Tour ${r}</span><span class="hist-words">${parts}</span></div>`;}
  document.getElementById('sp-hist-content').innerHTML=hist?`<div class="hist-title">Historique</div>${hist}`:'';
}

// ── LOBBY ──
function renderLobby(room){ _lastRoom=room;
  document.getElementById('l-codepill').textContent=room.code;
  document.getElementById('l-code').textContent=room.code;
  document.getElementById('l-title').textContent=S.isHost?'TA SALLE':'CONNECTÉ !';
  document.getElementById('l-host-ctrl').style.display=S.isHost?'block':'none';
  document.getElementById('l-guest-wait').style.display=S.isHost?'none':'block';
  const names=Object.keys(room.players).filter(n=>!room.players[n].isSpectator);
  const badge=document.getElementById('l-mode-badge');
  if(badge){badge.textContent=room.mode==='music'?'🎵 MODE MUSIC RATING':room.mode==='freetl'?'🌀 FREE TIERLIST':room.mode==='tierlist'?'🏆 MODE TIERLIST':'🕵️ MODE UNDERCOVER';}
  // Auto-start music if host just created a music room
  if(room.mode==='freetl' && S.isHost && room.phase==='lobby'){
    socket.emit('freetl:start');
  }
  if(room.mode==='music' && S.isHost && window._pendingMusicSettings && room.phase==='lobby'){
    const settings = window._pendingMusicSettings;
    window._pendingMusicSettings = null;
    setTimeout(()=>socket.emit('music:start', settings), 500);
  }
  document.getElementById('l-players').innerHTML=names.map((n,i)=>{
    const p=room.players[n];const isBot=p.isBot||false;
    return `<div class="prow"><div class="sdot ${p.connected?'':'off'}"></div><div><div class="pname">${EMOJIS[i%EMOJIS.length]} ${n}${isBot?' <span style="font-family:var(--fm);font-size:9px;color:var(--cyan);letter-spacing:.1em;border:1px solid rgba(0,229,255,.3);padding:1px 6px;margin-left:4px">BOT IA</span>':''}</div><div class="ptag">${n===room.host?'★ HÔTE':isBot?'intelligence artificielle':p.connected?'connecté':'déconnecté'}</div></div>${S.isHost&&n!==S.name&&!isBot?`<button class="pkick" onclick="socket.emit('player:kick',{target:'${n}'})">✕</button>`:''}${S.isHost&&isBot?`<button class="pkick" onclick="removeBot('${n}')" title="Retirer le bot" style="color:var(--cyan)">✕</button>`:''}</div>`;
  }).join('');
  if(S.isHost){const cn=names.filter(n=>room.players[n].connected).length;const isTlOrMusic=(room.mode==='tierlist'||room.mode==='music');document.getElementById('l-start').disabled=isTlOrMusic?(cn<2):(cn<3);}
  const scores=room.scores||{};const hasScores=names.some(n=>(scores[n]?.wins||0)>0);
  const ss=document.getElementById('scores-section');
  if(hasScores){ss.style.display='block';const sorted=[...names].sort((a,b)=>(scores[b]?.wins||0)-(scores[a]?.wins||0));document.getElementById('scores-list').innerHTML=sorted.map(n=>`<div class="score-row"><span class="score-name">${n}</span><span class="score-val">${scores[n]?.wins||0} pt${(scores[n]?.wins||0)>1?'s':''}</span></div>`).join('');}
  else{ss.style.display='none';}
}

// ── CREATE/JOIN/LEAVE ──
function createRoom(){
  const name=document.getElementById('c-name').value.trim();
  if(!name){toast('Entre ton prénom !','err');return;}
  S.genre=document.querySelector('.chip.on')?.dataset.g||'shonen';
  initSocket();setLoading(true,'CRÉATION…');
  socket.emit('room:create',{name,genre:S.genre,settings:{mrWhite:document.getElementById('opt-mrw').checked,doubleUndercover:document.getElementById('opt-uc2').checked,wordTimer:document.getElementById('opt-timer').checked}});
  socket.once('room:joined',()=>showScreen('s-lobby'));
}
function joinRoom(){
  const name=document.getElementById('j-name').value.trim();
  const code=document.getElementById('j-code').value.trim().toUpperCase();
  if(!name){toast('Entre ton prénom !','err');return;}
  if(code.length<4){toast('Code invalide !','err');return;}
  initSocket();setLoading(true,'CONNEXION…');
  socket.emit('room:join',{name,code});
  socket.once('room:joined',()=>showScreen('s-lobby'));
}
function joinAsSpectator(){
  if(!_pendingSpec)return;
  _isSpectator=true;
  socket.emit('room:join',{name:_pendingSpec.name,code:_pendingSpec.code,asSpectator:true});
}
// ══════════════════════════════════════
//  FREE TIERLIST MODE
// ══════════════════════════════════════
let _ftlRanking = [];
let _ftlSubmitted = false;

function handleFreeTlUpdate(room) {
  const ft = room.freetl;
  if (!ft) return;
  if (ft.phase === 'ranking') {
    showScreen('s-freetl-ranking');
    // Init ranking if new round
    if (_ftlRanking.length !== ft.characters.length) {
      _ftlRanking = ft.characters.map(c => c.name);
      _ftlSubmitted = !!ft.submissions[S.name];
    }
    renderFreeTlRanking(room);
  } else if (ft.phase === 'reveal') {
    showScreen('s-freetl-reveal');
    renderFreeTlReveal(room);
  }
}

function renderFreeTlRanking(room) {
  const ft = room.freetl;
  document.getElementById('freetl-round-label').textContent = `ROUND ${ft.round}`;
  const players = Object.keys(room.players).filter(p => room.players[p].connected && !room.players[p].isSpectator);
  const subCount = Object.keys(ft.submissions).length;
  document.getElementById('freetl-submitted-count').textContent = `${subCount}/${players.length} prêts`;

  const grid = document.getElementById('freetl-chars-grid');
  grid.innerHTML = '';
  _ftlRanking.forEach((name, i) => {
    const char = ft.characters.find(c => c.name === name) || {name, anime:''};
    const div = document.createElement('div');
    div.className = 'tl-char';
    div.draggable = !_ftlSubmitted;
    div.dataset.name = name;
    const rankClass = i===0?'r1':i===1?'r2':i===2?'r3':'';
    const img = CHARACTER_IMAGES_CLIENT[name];
    div.innerHTML = `
      <div class="tl-rank ${rankClass}">${i+1}</div>
      ${img ? `<img src="https://undercover-backend-4st4.onrender.com/img?url=${encodeURIComponent(img)}" onerror="this.style.display='none'" style="width:100%;height:80px;object-fit:cover;object-position:top">` : `<div style="height:80px;display:flex;align-items:center;justify-content:center;font-size:22px">🎭</div>`}
      <div class="tl-char-name">${name}<div style="font-size:8px;color:var(--muted)">${char.anime||''}</div></div>
    `;
    if (!_ftlSubmitted) {
      div.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', name); div.classList.add('dragging'); });
      div.addEventListener('dragend', () => div.classList.remove('dragging'));
      div.addEventListener('dragover', e => { e.preventDefault(); div.classList.add('drag-over'); });
      div.addEventListener('dragleave', () => div.classList.remove('drag-over'));
      div.addEventListener('drop', e => {
        e.preventDefault(); div.classList.remove('drag-over');
        const from = e.dataTransfer.getData('text/plain');
        if (from === name) return;
        const fi = _ftlRanking.indexOf(from), ti = _ftlRanking.indexOf(name);
        _ftlRanking.splice(fi, 1); _ftlRanking.splice(ti, 0, from);
        renderFreeTlRanking(room);
      });
    }
    grid.appendChild(div);
  });

  const btn = document.getElementById('freetl-submit-btn');
  const msg = document.getElementById('freetl-waiting-msg');
  if (_ftlSubmitted) { btn.style.display='none'; msg.style.display='block'; }
  else { btn.style.display='block'; msg.style.display='none'; }
}

function submitFreeTierlist() {
  if (_ftlSubmitted || _ftlRanking.length !== 10) return;
  socket.emit('freetl:submit', { ranking: _ftlRanking });
  _ftlSubmitted = true;
  document.getElementById('freetl-submit-btn').style.display = 'none';
  document.getElementById('freetl-waiting-msg').style.display = 'block';
  beep(660, 0.15); vibe(50);
}

function renderFreeTlReveal(room) {
  const ft = room.freetl;
  document.getElementById('freetl-reveal-round').textContent = `ROUND ${ft.round}`;
  const grid = document.getElementById('freetl-reveal-grid');
  const playerNames = Object.keys(room.players);
  grid.innerHTML = Object.entries(ft.submissions).map(([player, ranking]) => {
    const isMe = player === S.name;
    return `<div class="tl-player-card">
      <div class="tl-player-name">${EMOJIS[playerNames.indexOf(player) % EMOJIS.length]} ${player}${isMe?' (toi)':''}</div>
      <div class="tl-mini-list">${ranking.map((name, i) => {
        const char = ft.characters.find(c => c.name === name);
        return `<div class="tl-mini-char">
          <span class="tl-mini-rank">#${i+1}</span>
          <span style="font-size:11px">${name}</span>
          ${char ? `<span style="font-size:9px;color:var(--muted)">${char.anime}</span>` : ''}
        </div>`;
      }).join('')}</div>
    </div>`;
  }).join('');
  const nextBtn = document.getElementById('freetl-next-btn');
  if (nextBtn) nextBtn.style.display = S.isHost ? 'block' : 'none';
}

// Small client-side image map for free tierlist
const CHARACTER_IMAGES_CLIENT = {
  'Naruto Uzumaki':'https://cdn.myanimelist.net/images/characters/2/284121.jpg',
  'Sasuke Uchiha':'https://cdn.myanimelist.net/images/characters/9/131317.jpg',
  'Itachi Uchiha':'https://cdn.myanimelist.net/images/characters/15/72554.jpg',
  'Kakashi Hatake':'https://cdn.myanimelist.net/images/characters/7/284122.jpg',
  'Levi Ackerman':'https://cdn.myanimelist.net/images/characters/2/241413.jpg',
  'Eren Yeager':'https://cdn.myanimelist.net/images/characters/10/108914.jpg',
  'Mikasa Ackerman':'https://cdn.myanimelist.net/images/characters/9/108913.jpg',
  'Monkey D. Luffy':'https://cdn.myanimelist.net/images/characters/9/310307.jpg',
  'Zoro':'https://cdn.myanimelist.net/images/characters/3/100534.jpg',
  'Izuku Midoriya':'https://cdn.myanimelist.net/images/characters/5/312676.jpg',
  'Gojo Satoru':'https://cdn.myanimelist.net/images/characters/8/450358.jpg',
  'Tanjiro Kamado':'https://cdn.myanimelist.net/images/characters/3/418268.jpg',
  'Killua Zoldyck':'https://cdn.myanimelist.net/images/characters/7/171471.jpg',
  'Gon Freecss':'https://cdn.myanimelist.net/images/characters/11/174517.jpg',
  'L Lawliet':'https://cdn.myanimelist.net/images/characters/8/261785.jpg',
  'Light Yagami':'https://cdn.myanimelist.net/images/characters/9/261784.jpg',
  'Saitama':'https://cdn.myanimelist.net/images/characters/11/207828.jpg',
  'Guts':'https://cdn.myanimelist.net/images/characters/2/74908.jpg',
  'Griffith':'https://cdn.myanimelist.net/images/characters/2/74907.jpg',
  'Lelouch vi Britannia':'https://cdn.myanimelist.net/images/characters/8/76655.jpg',
  'Rem':'https://cdn.myanimelist.net/images/characters/13/321079.jpg',
  'Yuji Itadori':'https://cdn.myanimelist.net/images/characters/8/448083.jpg',
  'Denji':'https://cdn.myanimelist.net/images/characters/10/471020.jpg',
  'Edward Elric':'https://cdn.myanimelist.net/images/characters/11/174118.jpg',
};

// ══════════════════════════════════════
//  MUSIC RATING MODE
// ══════════════════════════════════════
let _musicAudio = null;
let _musicSegTimer = null;
let _musicCurrentTrack = null;

// Chip selection for music options
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#music-type-chips .chip').forEach(b => {
    b.onclick = () => { document.querySelectorAll('#music-type-chips .chip').forEach(x=>x.classList.remove('on')); b.classList.add('on'); };
  });
  document.querySelectorAll('#music-count-chips .chip').forEach(b => {
    b.onclick = () => { document.querySelectorAll('#music-count-chips .chip').forEach(x=>x.classList.remove('on')); b.classList.add('on'); };
  });
});

function createRoomMusic() {
  const name = document.getElementById('c-name').value.trim();
  if(!name){ toast('Entre ton prénom !','err'); return; }
  const type = document.querySelector('#music-type-chips .chip.on')?.dataset.t || 'both';
  const count = parseInt(document.querySelector('#music-count-chips .chip.on')?.dataset.c || '8');
  window._pendingMusicSettings = { type, count };
  initSocket();
  setLoading(true,'CRÉATION…');
  socket.once('room:joined', () => showScreen('s-lobby'));
  socket.emit('room:create', { name, genre:'mix', settings:{mrWhite:false,doubleUndercover:false,wordTimer:false}, mode:'music' });
}

function handleMusicUpdate(room) {
  const m = room.music;
  if(!m) return;
  if(m.phase === 'done') { showScreen('s-music-done'); renderMusicRecap(room); return; }
  if(m.phase !== 'playing') return;
  showScreen('s-music-player');
  const track = m.tracks[m.currentIndex];
  if(!track) return;
  // Update UI
  document.getElementById('mp-progress').textContent = `${m.currentIndex+1} / ${m.tracks.length}`;
  document.getElementById('mp-type-label').textContent = `${track.type}${track.sequence > 1 ? track.sequence : ''} — ${track.anime}`;
  document.getElementById('mp-song-title').textContent = track.title;
  document.getElementById('mp-anime-name').textContent = track.anime;
  document.getElementById('mp-host-controls').style.display = S.isHost ? 'block' : 'none';
  // Load audio if track changed
  if(!_musicCurrentTrack || _musicCurrentTrack.id !== track.id) {
    _musicCurrentTrack = track;
    loadAudio(track.audioUrl);
    // Reset rating slider
    document.getElementById('mp-rating-slider').value = 5;
    document.getElementById('mp-rating-val').textContent = '5.0';
  }
  // Render live ratings
  renderLiveRatings(m);
}

function loadAudio(url) {
  if(_musicAudio) { _musicAudio.pause(); _musicAudio = null; }
  if(_musicSegTimer) { clearTimeout(_musicSegTimer); _musicSegTimer = null; }
  const proxyUrl = `https://undercover-backend-4st4.onrender.com/audio?url=${encodeURIComponent(url)}`;
  _musicAudio = new Audio(proxyUrl);
  _musicAudio.volume = parseFloat(document.getElementById('mp-volume')?.value ?? 1);
  _musicAudio.addEventListener('timeupdate', updateAudioBar);
  _musicAudio.addEventListener('loadedmetadata', () => {
    document.getElementById('mp-time-tot').textContent = fmtTime(_musicAudio.duration);
  });
  _musicAudio.addEventListener('error', (e) => {
    toast('Erreur chargement audio — essaie une autre musique', 'err');
    console.error('Audio error:', e);
  });
  document.getElementById('mp-play-btn').textContent = '▶';
  document.getElementById('mp-bar').style.width = '0%';
  document.getElementById('mp-time-cur').textContent = '0:00';
}

function togglePlay() {
  if(!_musicAudio) return;
  if(_musicAudio.paused) { _musicAudio.play(); document.getElementById('mp-play-btn').textContent = '⏸'; }
  else { _musicAudio.pause(); document.getElementById('mp-play-btn').textContent = '▶'; }
}

function playSegment(seg) {
  if(!_musicAudio) return;
  if(_musicSegTimer) clearTimeout(_musicSegTimer);
  if(seg === 'intro') {
    _musicAudio.currentTime = 0;
    _musicAudio.play();
    document.getElementById('mp-play-btn').textContent = '⏸';
    _musicSegTimer = setTimeout(() => {
      _musicAudio.pause();
      document.getElementById('mp-play-btn').textContent = '▶';
    }, 10000);
  } else {
    _musicAudio.currentTime = 60;
    _musicAudio.play();
    document.getElementById('mp-play-btn').textContent = '⏸';
    _musicSegTimer = setTimeout(() => {
      _musicAudio.pause();
      document.getElementById('mp-play-btn').textContent = '▶';
    }, 20000);
  }
  beep(440, 0.1); vibe(30);
}

function seekAudio(e) {
  if(!_musicAudio || !_musicAudio.duration) return;
  const rect = document.getElementById('mp-bar-wrap').getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  _musicAudio.currentTime = pct * _musicAudio.duration;
}

function updateAudioBar() {
  if(!_musicAudio || !_musicAudio.duration) return;
  const pct = (_musicAudio.currentTime / _musicAudio.duration) * 100;
  document.getElementById('mp-bar').style.width = pct + '%';
  document.getElementById('mp-time-cur').textContent = fmtTime(_musicAudio.currentTime);
}

function fmtTime(s) {
  const m = Math.floor(s/60);
  const sec = Math.floor(s%60).toString().padStart(2,'0');
  return `${m}:${sec}`;
}

function updateMyRating(val) {
  document.getElementById('mp-rating-val').textContent = parseFloat(val).toFixed(1);
  const idx = _lastRoom?.music?.currentIndex ?? 0;
  socket.emit('music:rate', { trackIndex: idx, rating: parseFloat(val) });
}

function renderLiveRatings(m) {
  const idx = m.currentIndex;
  const ratings = m.ratings?.[idx] || {};
  const el = document.getElementById('mp-live-ratings');
  if(!el) return;
  const players = Object.keys(ratings);
  if(!players.length) { el.innerHTML = '<div style="color:var(--muted);font-size:12px">En attente des notes…</div>'; return; }
  el.innerHTML = players.map(p => {
    const r = ratings[p];
    const color = r >= 8 ? 'var(--gold)' : r >= 5 ? 'var(--fg)' : 'var(--muted)';
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <span style="font-size:13px;min-width:90px">${p}</span>
      <div style="flex:1;height:4px;background:var(--border);border-radius:2px">
        <div style="height:100%;width:${r*10}%;background:${color};border-radius:2px;transition:width .3s"></div>
      </div>
      <span style="font-family:var(--fm);font-size:13px;color:${color};min-width:32px;text-align:right">${r.toFixed(1)}</span>
    </div>`;
  }).join('');
}

function renderMusicRecap(room) {
  const m = room.music;
  const el = document.getElementById('music-recap');
  if(!el || !m?.tracks) return;
  el.innerHTML = m.tracks.map((track, i) => {
    const ratings = m.ratings?.[i] || {};
    const vals = Object.values(ratings);
    const avg = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : '—';
    return `<div style="background:var(--ink2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px">
      <div style="font-weight:700;margin-bottom:4px">${track.title} <span style="font-size:11px;color:var(--muted);font-weight:400">— ${track.anime}</span></div>
      <div style="font-family:var(--fm);font-size:10px;color:var(--cyan);margin-bottom:8px">${track.type} · Moyenne : ${avg}/10</div>
      ${Object.entries(ratings).map(([p,r]) => `<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:2px"><span>${p}</span><span style="color:var(--gold)">${r.toFixed(1)}</span></div>`).join('')}
    </div>`;
  }).join('');
}

let _selectedMode = null;

function selectMode(mode) {
  _selectedMode = mode;
  document.getElementById('mode-uc').style.borderColor = mode==='undercover' ? 'var(--gold)' : 'var(--border)';
  document.getElementById('mode-tl').style.borderColor = mode==='tierlist' ? 'var(--cyan)' : 'var(--border)';
  const freetlEl = document.getElementById('mode-freetl');
  if(freetlEl) freetlEl.style.borderColor = mode==='freetl' ? 'var(--cyan)' : 'var(--border)';
  const musicEl = document.getElementById('mode-music');
  if(musicEl) musicEl.style.borderColor = mode==='music' ? '#ff6b9d' : 'var(--border)';
  const btn = document.getElementById('mode-confirm-btn');
  btn.style.opacity = '1';
  btn.style.pointerEvents = 'auto';
  btn.style.borderColor = mode==='tierlist' ? 'var(--cyan)' : '';
}

function confirmModeAndCreate() {
  const name = document.getElementById('c-name').value.trim();
  if(!name) { toast('Entre ton prénom !','err'); return; }
  if(_selectedMode === 'undercover') {
    showScreen('s-create');
  } else if(_selectedMode === 'tierlist') {
    createRoomWithMode('tierlist');
  } else if(_selectedMode === 'freetl') {
    createRoomWithMode('freetl');
  } else if(_selectedMode === 'music') {
    showScreen('s-music-options');
  }
}

function createRoomWithMode(mode) {
  const name = document.getElementById('c-name').value.trim();
  if(!name){toast('Entre ton prénom !','err');return;}
  initSocket();
  setLoading(true,'CRÉATION…');
  socket.emit('room:create',{name, genre:'mix', settings:{mrWhite:false,doubleUndercover:false,wordTimer:false}, mode});
}

function addBot(){socket.emit('bot:add');}
function removeBot(name){socket.emit('bot:remove',{botName:name});}
function leaveRoom(){
  if(socket)socket.emit('room:leave');
  sessionStorage.removeItem('uc');clearClientTimer();resetState();_isSpectator=false;_pendingSpec=null;
  showScreen('s-home');
}
function copyCode(){navigator.clipboard.writeText(S.code).then(()=>toast('Code copié : '+S.code,'ok'));}
function hostStart(){
  setLoading(true,'PRÉPARATION…');
  socket.emit('game:start',{genre:S.genre,settings:{mrWhite:document.getElementById('opt-mrw')?.checked,doubleUndercover:document.getElementById('opt-uc2')?.checked,wordTimer:document.getElementById('opt-timer')?.checked}});
}
function hostStartAuto() {
  if(!S.isHost) return;
  // Check room mode from server
  const room = _lastRoom;
  if(room && room.mode === 'tierlist') {
    hostStartTierlist();
  } else {
    hostStart();
  }
}


// ── CARD ──
function buildCardFront(a){
  const imgEl=document.getElementById('cf-img');
  if(a.image){const proxyUrl=`https://undercover-backend-4st4.onrender.com/img?url=${encodeURIComponent(a.image)}`;imgEl.innerHTML=`<img src="${proxyUrl}" alt="" onerror="this.parentElement.innerHTML='<div class=cf-img-ph>🎭</div>'"/>`;}
  else{imgEl.innerHTML=`<div class="cf-img-ph">${a.role==='mr-white'?'❓':'🎭'}</div>`;}
  if(a.role==='mr-white'){document.getElementById('cf-name').textContent='Rôle caché';document.getElementById('cf-name').className='cf-name unk';document.getElementById('cf-hint').textContent='Tu ne sais pas quel perso. Bluff pour survivre !';}
  else{document.getElementById('cf-name').textContent=a.word||'—';document.getElementById('cf-name').className='cf-name';document.getElementById('cf-hint').textContent=`⚠️ Interdit : ${(a.blockedWords||[]).join(', ')||a.word}`;}
}
function flipCard(){if(S.cardFlipped)return;S.cardFlipped=true;document.getElementById('the-card').classList.add('flipped');document.getElementById('rv-tap').style.display='none';document.getElementById('rv-done').style.display='block';soundOk();vibeOk();}
function doneReading(){document.getElementById('the-card').classList.remove('flipped');socket.emit('player:ready');showScreen('s-waiting');}
function renderReadyList(players){document.getElementById('rlist').innerHTML=Object.entries(players).filter(([,p])=>!p.isSpectator).map(([n,p])=>`<div class="rrow"><div class="rdot ${p.ready?'ok':''}"></div><span class="rname">${n}</span><span class="rstatus ${p.ready?'done':''}">${p.ready?'Lu ✓':'en lecture…'}</span></div>`).join('');}

// ── TIMER ──
function startClientTimer(endTimestamp,phase){
  clearClientTimer();
  const total=phase==='words'?45:60;
  const fill=document.getElementById('timer-fill'),label=document.getElementById('timer-label'),wrap=document.getElementById('timer-wrap');
  wrap.style.display='block';
  timerInterval=setInterval(()=>{
    const remaining=Math.max(0,Math.round((endTimestamp-Date.now())/1000));
    fill.style.width=(remaining/total*100)+'%';
    label.textContent=remaining+'s';
    fill.classList.toggle('urgent',remaining<=10);
    if(remaining<=10&&remaining>0)soundTimer();
    if(remaining<=5&&remaining>0)vibe(30);
    if(remaining===0)clearClientTimer();
  },1000);
}
function clearClientTimer(){if(timerInterval){clearInterval(timerInterval);timerInterval=null;}const w=document.getElementById('timer-wrap');if(w)w.style.display='none';}

// ── PLAYING ──
function renderPlaying(room){
  if(room)_lastRoom=room;else room=_lastRoom;if(!room)return;
  const players=room.players||{};
  const names=Object.keys(players).filter(n=>!players[n].isSpectator);
  const alive=names.filter(n=>!players[n].eliminated);
  const rk=`round${room.round}`;
  const wordsNow=room.words?.[rk]||{};
  const votesNow=room.votes?.[rk]||{};
  const accusationsNow=room.accusations?.[rk]||{};
  document.getElementById('g-round').textContent=room.round;
  document.getElementById('g-alive').textContent=alive.length;

  // Turn order bar
  const turnOrder=room.turnOrder||[];
  const tobEl=document.getElementById('turn-order-bar');
  const tolEl=document.getElementById('turn-order-list');
  if(turnOrder.length>0&&S.subPhase==='words'){
    tobEl.style.display='block';
    tolEl.innerHTML=turnOrder.map((n,i)=>{
      const hasWord=!!wordsNow[n];
      const isMine=n===S.name;
      return `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border:1px solid ${isMine?'var(--gold)':hasWord?'rgba(0,255,135,.3)':'var(--border)'};color:${isMine?'var(--gold)':hasWord?'var(--green)':'var(--muted)'};font-size:10px;background:${isMine?'rgba(255,214,10,.06)':'transparent'}">
        <span>${i+1}.</span>
        <span>${EMOJIS[names.indexOf(n)%EMOJIS.length]}</span>
        <span>${n}</span>
        ${hasWord?'<span style="color:var(--green)">✓</span>':''}
      </span>`;
    }).join('');
  } else { tobEl.style.display='none'; }

  const voteTally={};alive.forEach(n=>{voteTally[n]=0;});Object.values(votesNow).forEach(t=>{if(voteTally[t]!==undefined)voteTally[t]++;});
  const accTally={};alive.forEach(n=>{accTally[n]=0;});Object.values(accusationsNow).forEach(t=>{if(accTally[t]!==undefined)accTally[t]++;});

  if(S.myAssignment?.word){document.getElementById('my-word').style.display='flex';document.getElementById('mw-v').textContent=S.myAssignment.word;document.getElementById('mw-role').textContent=S.myAssignment.role==='undercover'?'🕵️':'👤';}

  document.getElementById('pgrid').innerHTML=names.map((n,i)=>{
    const acc=accTally[n]||0;
    const isBot=players[n]?.isBot||false;
    return `<div class="pcard ${players[n].eliminated?'dead':''} ${_myVote===n&&!players[n].eliminated?'voted-for':''}"><span class="pc-em">${EMOJIS[i%EMOJIS.length]}</span><div style="flex:1"><div class="pc-n">${n}${isBot?' <span style=\"font-family:var(--fm);font-size:8px;color:var(--cyan);letter-spacing:.1em\">BOT</span>':''}</div><div class="pc-s">${players[n].eliminated?'☠ éliminé':'en vie'}</div>${acc>0?`<div style="font-family:var(--fm);font-size:9px;color:var(--red);margin-top:2px">👉 x${acc}</div>`:''}</div>${S.subPhase==='vote'&&(voteTally[n]||0)>0&&!players[n].eliminated?`<span class="pc-votes">${voteTally[n]}▲</span>`:''}</div>`;
  }).join('');

  if(room.mrWhiteGuessPhase){document.getElementById('words-box').style.display='none';document.getElementById('vote-box').style.display='none';if(S.myAssignment?.role==='mr-white')document.getElementById('mrw-box').classList.add('show');return;}

  const aliveActive=alive.filter(n=>!players[n].eliminated);
  const allDone=aliveActive.length>0&&aliveActive.every(n=>wordsNow[n]);
  if(allDone)S.subPhase='vote';

  // ── WORDS PHASE ──
  if(S.subPhase==='words'){
    document.getElementById('words-box').style.display='block';document.getElementById('vote-box').style.display='none';

    const mine = wordsNow[S.name];
    const isMyTurn = _currentTurnPlayer === S.name;
    const iEliminated = players[S.name]?.eliminated;

    // Input: only show if it's my turn AND I haven't submitted yet
    document.getElementById('winput-row').style.display = (!mine && isMyTurn && !iEliminated) ? 'flex' : 'none';
    document.getElementById('sub-notice').classList.toggle('show', !!mine && !isMyTurn);

    // "Your turn" or "waiting" message
    let statusHtml = '';
    if(!mine && !iEliminated){
      if(isMyTurn){
        statusHtml = `<div style="display:flex;align-items:center;gap:8px;padding:8px 0 4px;font-family:var(--fm);font-size:11px;color:var(--gold);letter-spacing:.1em;animation:blink 1s infinite">🎯 C'EST TON TOUR — écris ton mot !</div>`;
      } else if(_currentTurnPlayer){
        statusHtml = `<div style="padding:8px 0 4px;font-family:var(--fm);font-size:11px;color:var(--muted);letter-spacing:.08em">⏳ Tour de <b style="color:var(--text)">${_currentTurnPlayer}</b>…</div>`;
      }
    } else if(mine) {
      statusHtml = `<div style="display:flex;align-items:center;gap:8px;padding:8px 0 4px;font-family:var(--fm);font-size:11px;color:var(--green);letter-spacing:.1em">✓ Mot envoyé${_currentTurnPlayer && !isMyTurn ? ` — tour de <b>${_currentTurnPlayer}</b>` : ''}</div>`;
    }

    document.getElementById('words-list').innerHTML = statusHtml + aliveActive.map(n=>{const w=wordsNow[n];const isNext=_currentTurnPlayer===n&&!w;const isBot=players[n]?.isBot;return `<div class="wentry ${isNext?'active-turn':''}"><span class="we-auth">${EMOJIS[names.indexOf(n)%EMOJIS.length]} ${n}${isBot?' 🤖':''}${isNext?' ✍️':''}</span>${w?`<span class="we-word">${w}</span>`:`<span class="we-pend">${isNext?(isBot?'le bot réfléchit…':'en train d\'écrire…'):'en attente…'}</span>`}</div>`;}).join('');

    const as=document.getElementById('accuse-section');
    if(mine&&!iEliminated){
      as.style.display='block';const myAcc=accusationsNow[S.name];
      document.getElementById('accuse-btns').innerHTML=aliveActive.filter(n=>n!==S.name).map(n=>`<button class="chip ${myAcc===n?'on':''}" onclick="accuse('${n}')" ${myAcc?'disabled':''}>${EMOJIS[names.indexOf(n)%EMOJIS.length]} ${n}</button>`).join('');
    }else{as.style.display='none';}
    renderHistory(room,names);

  // ── VOTE PHASE ──
  }else{
    document.getElementById('words-box').style.display='none';document.getElementById('vote-box').style.display='block';document.getElementById('accuse-section').style.display='none';tobEl.style.display='none';

    // Show all rounds words in summary (not just current round)
    let wsHtml='';
    for(let r=Math.max(1,room.round-1);r<=room.round;r++){
      const rwk=`round${r}`;const rw=room.words?.[rwk]||{};
      const hasWords=aliveActive.some(n=>rw[n]);
      if(hasWords)wsHtml+=`<div style="font-family:var(--fm);font-size:9px;letter-spacing:.15em;color:var(--muted);text-transform:uppercase;margin-bottom:5px;margin-top:${r>1?'10px':'0'}">Tour ${r}</div>`+aliveActive.map(n=>`<div class="wentry"><span class="we-auth">${EMOJIS[names.indexOf(n)%EMOJIS.length]} ${n}</span><span class="we-word">${rw[n]||'—'}</span>${(accTally[n]||0)>0&&r===room.round?`<span style="font-family:var(--fm);font-size:10px;color:var(--red);margin-left:4px">👉${accTally[n]}</span>`:''}</div>`).join('');
    }
    document.getElementById('ws-content').innerHTML=wsHtml;

    const hn=document.getElementById('host-note'),vb=document.getElementById('vbtns');
    const myVoted=players[S.name]?.voted;
    hn.textContent=myVoted?'Vote envoyé ✓ — en attente des autres.':'Vote pour le suspect à éliminer.';

    const maxV=Math.max(...Object.values(voteTally),0);
    // Everyone votes the same way — host is NOT special during vote
    vb.innerHTML=aliveActive.map(n=>{
      const votes=voteTally[n]||0,isL=votes>0&&votes===maxV,isM=_myVote===n;
      const isSelf=n===S.name;
      return `<button class="vbtn ${isM?'selected':''} ${isL?'leading':''}" onclick="castVote('${n}')" ${(myVoted&&!isM)||isSelf?'disabled':''}>${EMOJIS[names.indexOf(n)%EMOJIS.length]} ${n}${votes>0?`<span class="vbtn-votes">${votes}v</span>`:''}</button>`;
    }).join('');

    // Host override section (separate from normal vote buttons)
    if(S.isHost){
      vb.innerHTML+=`<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
        <div style="font-family:var(--fm);font-size:9px;letter-spacing:.2em;color:var(--muted);text-transform:uppercase;margin-bottom:8px">⚡ Décision hôte (override)</div>
        ${aliveActive.map(n=>`<button class="vbtn" style="border-color:rgba(255,45,85,.2)" onclick="if(confirm('Forcer l\\'élimination de ${n} ?'))socket.emit('vote:eliminate',{target:'${n}'})">${EMOJIS[names.indexOf(n)%EMOJIS.length]} ${n} <span style="margin-left:auto;font-family:var(--fm);font-size:10px;color:var(--red)">FORCER</span></button>`).join('')}
      </div>`;
    }
  }
}

function accuse(target){socket.emit('player:accuse',{target});soundAccuse();vibeOk();if(_lastRoom){const rk=`round${_lastRoom.round}`;if(!_lastRoom.accusations)_lastRoom.accusations={};if(!_lastRoom.accusations[rk])_lastRoom.accusations[rk]={};_lastRoom.accusations[rk][S.name]=target;renderPlaying(null);}}
function renderHistory(room,names){const h=document.getElementById('hist-section');if(room.round<=1){h.innerHTML='';return;}let html=`<div class="hist-title">Historique</div>`;for(let r=1;r<room.round;r++){const rk=`round${r}`;const words=room.words?.[rk]||{};const parts=names.filter(n=>words[n]).map(n=>`${n}: <b>${words[n]}</b>`).join(' · ');if(parts)html+=`<div class="hist-row"><span class="hist-round">Tour ${r}</span><span class="hist-words">${parts}</span></div>`;}h.innerHTML=html;}
function castVote(target){if(_myVote)return;_myVote=target;socket.emit('vote:cast',{target});soundOk();vibeOk();if(_lastRoom)renderPlaying(_lastRoom);}
function submitWord(){const input=document.getElementById('word-input');const word=input.value.trim();if(!word){toast('Entre un mot !','err');return;}socket.emit('word:submit',{word});input.value='';soundOk();vibeOk();if(_lastRoom){const rk=`round${_lastRoom.round}`;if(!_lastRoom.words)_lastRoom.words={};if(!_lastRoom.words[rk])_lastRoom.words[rk]={};_lastRoom.words[rk][S.name]=word;document.getElementById('winput-row').style.display='none';document.getElementById('sub-notice').classList.add('show');renderPlaying(null);}}
function submitMrwGuess(){const g=document.getElementById('mrw-input').value.trim();if(!g)return;socket.emit('mrwhite:guess',{guess:g});document.getElementById('mrw-box').classList.remove('show');}

// ── WORD REVEAL CARD ──
let _revealQueue=[], _revealActive=false;
function showWordReveal(player, word){
  _revealQueue.push({player,word});
  if(!_revealActive)processRevealQueue();
}
function processRevealQueue(){
  if(_revealQueue.length===0){_revealActive=false;return;}
  _revealActive=true;
  const {player,word}=_revealQueue.shift();
  const room=_lastRoom;
  const players=room?.players||{};
  const names=Object.keys(players).filter(n=>!players[n].isSpectator);
  const idx=names.indexOf(player);
  document.getElementById('wrc-emoji').textContent=EMOJIS[idx>=0?idx%EMOJIS.length:0];
  document.getElementById('wrc-name').textContent=player;
  document.getElementById('wrc-word').textContent=word;
  const card=document.getElementById('word-reveal-card');
  // Rebuild bar animation
  const bar=card.querySelector('.wrc-bar');
  bar.style.animation='none';void bar.offsetWidth;bar.style.animation='wrcBar .5s ease .1s both';
  card.classList.add('show');
  beep(600,.08,.12);vibe(30);
  setTimeout(()=>{
    card.classList.remove('show');
    setTimeout(()=>processRevealQueue(), 200);
  }, 2200);
}

// ── ELIM OVERLAY ──
function showElimOverlay(name){const el=document.getElementById('elim-overlay');document.getElementById('elim-name').textContent=name;document.getElementById('elim-sub').textContent='a été éliminé de la partie';document.getElementById('elim-continue').style.display='none';el.classList.add('show');setTimeout(()=>{document.getElementById('elim-continue').style.display='block';setTimeout(()=>el.classList.remove('show'),3000);},2500);}

// ── RESULT ──
function renderResult(room){
  const o=room.result?.outcome;
  const win=o==='civilians-win';
  const tm={'civilians-win':'VICTOIRE','undercover-wins':'INFILTRÉ','mrwhite-wins':'MR. WHITE'};
  const sm={'civilians-win':"Les civils ont démasqué l'imposteur !",'undercover-wins':"L'Undercover a survécu…",'mrwhite-wins':'Mr. White a deviné le mot civil !'};
  document.getElementById('res-glow').className=win?'res-glow-win':'res-glow-lose';
  const el=document.getElementById('res-title');el.textContent=tm[o]||'FIN';el.className='res-title '+(win?'win':'lose');
  document.getElementById('res-sub').textContent=sm[o]||'';
  if(win){soundVictory();vibe([50,30,50,30,200]);}else{soundElim();vibeElim();}
  const asgn=room.assignments||{};
  const ucs=Object.entries(asgn).filter(([,a])=>a.role==='undercover').map(([n])=>n);
  const mrw=Object.entries(asgn).find(([,a])=>a.role==='mr-white')?.[0];
  document.getElementById('res-details').innerHTML=`<div class="rcr"><span class="rcl">Mot Civil</span><span class="rcv cv">${room.wordPair?.civilian||'—'}</span></div><div class="rcr"><span class="rcl">Mot Undercover</span><span class="rcv rv">${room.wordPair?.undercover||'—'}</span></div><div class="rcr"><span class="rcl">Undercover${ucs.length>1?'s':''}</span><span class="rcv rv">${ucs.join(', ')||'—'}</span></div>${mrw?`<div class="rcr"><span class="rcl">Mr. White</span><span class="rcv" style="color:var(--muted)">${mrw}</span></div>`:''}<div class="rcr"><span class="rcl">Animés</span><span class="rcv" style="color:var(--muted);font-size:11px;font-family:var(--fm)">${room.wordPair?.anime1} vs ${room.wordPair?.anime2}</span></div>${room.wordPair?.hint?`<div class="rcr"><span class="rcl">Pourquoi similaires</span><span class="rcv" style="color:var(--muted);font-size:11px;font-family:var(--fm);text-align:right">${room.wordPair.hint}</span></div>`:''}`;
  const scores=room.scores||{};const names=Object.keys(room.players||{}).filter(n=>!room.players[n].isSpectator);
  const hasScores=names.some(n=>(scores[n]?.wins||0)>0);const rsBox=document.getElementById('res-scores');
  if(hasScores){rsBox.style.display='block';const sorted=[...names].sort((a,b)=>(scores[b]?.wins||0)-(scores[a]?.wins||0));document.getElementById('rs-rows').innerHTML=sorted.map((n,i)=>`<div class="rs-row"><div><div class="rs-name">${i===0?'🥇 ':i===1?'🥈 ':i===2?'🥉 ':''}${n}</div><div class="rs-role">${roleLabel(asgn[n]?.role)}</div></div><span class="rs-score">${scores[n]?.wins||0} pts</span></div>`).join('');}
  else{rsBox.style.display='none';}
  document.getElementById('res-replay').style.display=S.isHost?'inline-flex':'none';
}
function roleLabel(r){if(r==='undercover')return '🕵️ Undercover';if(r==='mr-white')return '❓ Mr. White';return '👤 Civil';}
function hostReset(){socket.emit('game:reset');}

// ── SHARE SCORE ──
function shareScore(){
  if(!_lastRoom)return;
  const scores=_lastRoom.scores||{};
  const players=Object.keys(_lastRoom.players||{}).filter(n=>!_lastRoom.players[n].isSpectator);
  const sorted=[...players].sort((a,b)=>(scores[b]?.wins||0)-(scores[a]?.wins||0));
  const outcome=_lastRoom.result?.outcome;
  const ot={'civilians-win':"Les civils ont gagné !",'undercover-wins':"L'Undercover a survécu !",'mrwhite-wins':"Mr. White a deviné !"}[outcome]||'';
  const text=`🕵️ UNDERCOVER ANIMÉ\n${ot}\n\n🏆 Scores :\n${sorted.map((n,i)=>`${i===0?'🥇':i===1?'🥈':i===2?'🥉':'  '} ${n} — ${scores[n]?.wins||0} pt${(scores[n]?.wins||0)>1?'s':''}`).join('\n')}\n\nJoue sur : mjgtell.github.io/Undercover-Anim-`;
  if(navigator.share)navigator.share({title:'Undercover Animé',text}).catch(()=>{});
  else navigator.clipboard.writeText(text).then(()=>toast('Scores copiés !','ok'));
}


// ══════════════════════════════════════════════════════
//  VOICE CHAT — WebRTC mesh + Web Audio
// ══════════════════════════════════════════════════════

const STUN = { iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]};


// ══════════════════════════════════════
//  TIERLIST MODE
// ══════════════════════════════════════

let _tlRanking = []; // current drag order
let _tlSubmitted = false;
let _tlVoted = false;

function hostStartTierlist() {
  if(!S.isHost) return;
  socket.emit('tierlist:start');
}

function renderTierlistRanking(room) {
  const tl = room.tierlist;
  if(!tl || !tl.characters) return;
  document.getElementById('tl-anime-label').textContent = 'TIERLIST';
  document.getElementById('tl-anime-title').textContent = tl.anime?.title || '';

  // Init ranking order if needed
  if(_tlRanking.length !== tl.characters.length) {
    _tlRanking = tl.characters.map(c => c.name);
  }

  const grid = document.getElementById('tl-chars-grid');
  grid.innerHTML = '';
  _tlRanking.forEach((name, i) => {
    const char = tl.characters.find(c => c.name === name) || {name, image:null};
    const div = document.createElement('div');
    div.className = 'tl-char';
    div.draggable = !_tlSubmitted;
    div.dataset.name = name;
    const rankClass = i===0?'r1':i===1?'r2':i===2?'r3':'';
    div.innerHTML = `
      <div class="tl-rank ${rankClass}">${i+1}</div>
      ${char.image ? `<img src="https://undercover-backend-4st4.onrender.com/img?url=${encodeURIComponent(char.image)}" onerror="this.style.display='none'">` : ''}
      <div class="tl-char-name">${name}</div>
    `;
    if(!_tlSubmitted) {
      div.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', name); div.classList.add('dragging'); });
      div.addEventListener('dragend', () => div.classList.remove('dragging'));
      div.addEventListener('dragover', e => { e.preventDefault(); div.classList.add('drag-over'); });
      div.addEventListener('dragleave', () => div.classList.remove('drag-over'));
      div.addEventListener('drop', e => {
        e.preventDefault();
        div.classList.remove('drag-over');
        const from = e.dataTransfer.getData('text/plain');
        const to = name;
        if(from === to) return;
        const fi = _tlRanking.indexOf(from);
        const ti = _tlRanking.indexOf(to);
        _tlRanking.splice(fi, 1);
        _tlRanking.splice(ti, 0, from);
        renderTierlistRanking(room);
      });
    }
    grid.appendChild(div);
  });

  // Show who submitted
  const subs = Object.keys(tl.submissions || {}).filter(k => tl.submissions[k]);
  const total = Object.keys(room.players).filter(p => room.players[p].connected && !room.players[p].isSpectator).length;
  document.getElementById('tl-submitted-list').textContent = subs.length > 0 ? `${subs.length}/${total} ont validé` : '';

  const btn = document.getElementById('tl-submit-btn');
  const msg = document.getElementById('tl-waiting-msg');
  if(_tlSubmitted) { btn.style.display='none'; msg.style.display='block'; }
  else { btn.style.display='block'; msg.style.display='none'; }
}

function submitTierlist() {
  if(_tlSubmitted || _tlRanking.length !== 10) return;
  socket.emit('tierlist:submit', { ranking: _tlRanking });
  _tlSubmitted = true;
  const btn = document.getElementById('tl-submit-btn');
  const msg = document.getElementById('tl-waiting-msg');
  btn.style.display = 'none';
  msg.style.display = 'block';
  beep(660, 0.15); vibe(50);
}

function renderTierlistReveal(room) {
  const tl = room.tierlist;
  document.getElementById('tl-reveal-label').textContent = tl.anime?.title || '';
  const grid = document.getElementById('tl-reveal-grid');
  grid.innerHTML = '';
  Object.entries(tl.submissions || {}).forEach(([player, ranking]) => {
    const card = document.createElement('div');
    card.className = 'tl-player-card';
    const isMe = player === S.name;
    card.innerHTML = `<div class="tl-player-name">${EMOJIS[Object.keys(room.players).indexOf(player) % EMOJIS.length]} ${player}${isMe?' (toi)':''}</div>
    <div class="tl-mini-list">${ranking.map((name,i) => {
      const char = tl.characters.find(c => c.name === name);
      return `<div class="tl-mini-char">
        <span class="tl-mini-rank">#${i+1}</span>
        ${char?.image ? `<img class="tl-mini-img" src="https://undercover-backend-4st4.onrender.com/img?url=${encodeURIComponent(char.image)}" onerror="this.style.display='none'">` : ''}
        <span style="font-size:11px">${name}</span>
      </div>`;
    }).join('')}</div>`;
    grid.appendChild(card);
  });
  const voteBtn = document.getElementById('tl-vote-btn');
  if(voteBtn) voteBtn.style.display = S.isHost ? 'block' : 'none';
}

function renderTierlistVote(room) {
  const tl = room.tierlist;
  const grid = document.getElementById('tl-vote-grid');
  grid.innerHTML = '';
  Object.entries(tl.submissions || {}).forEach(([player, ranking]) => {
    const isMe = player === S.name;
    const hasVoted = tl.votes && tl.votes[S.name];
    const card = document.createElement('div');
    card.className = `tl-vote-card${isMe?' mine':''}${tl.votes?.[S.name]===player?' voted':''}`;
    card.innerHTML = `<div class="tl-player-name">${player}${isMe?' (toi — tu ne peux pas voter)':''}</div>
    <div class="tl-mini-list">${ranking.slice(0,5).map((name,i) => `<div class="tl-mini-char"><span class="tl-mini-rank">#${i+1}</span><span style="font-size:11px">${name}</span></div>`).join('')}<span style="font-size:10px;color:var(--muted);margin-left:4px">+5 autres</span></div>`;
    if(!isMe && !hasVoted) {
      card.onclick = () => {
        if(_tlVoted) return;
        _tlVoted = true;
        socket.emit('tierlist:vote', { target: player });
        beep(880, 0.15); vibe(60);
      };
    }
    grid.appendChild(card);
  });
}

function renderTierlistResult(room) {
  const tl = room.tierlist;
  const winners = tl.winner || [];
  document.getElementById('tl-result-winner').textContent = winners.length === 1
    ? `🏆 ${winners[0]} remporte ce round !`
    : `🤝 Égalité entre ${winners.join(' & ')} !`;

  const scoreList = document.getElementById('tl-scores-list');
  const maxScore = Math.max(...Object.values(tl.scores || {}), 1);
  scoreList.innerHTML = Object.entries(tl.scores || {})
    .sort(([,a],[,b]) => b-a)
    .map(([p, s]) => `<div class="tl-score-row">
      <span style="min-width:100px;font-size:13px">${p}</span>
      <div class="tl-score-bar"><div class="tl-score-fill" style="width:${(s/10)*100}%"></div></div>
      <span style="font-family:var(--fm);font-size:12px;color:var(--gold)">${s}/10</span>
    </div>`).join('');

  const nextBtn = document.getElementById('tl-next-btn');
  if(nextBtn) nextBtn.style.display = S.isHost ? 'block' : 'none';
}

// Handle tierlist room updates
function handleTierlistUpdate(room) {
  const tl = room.tierlist;
  if(!tl) return;
  switch(tl.phase) {
    case 'ranking':
      showScreen('s-tierlist-ranking');
      renderTierlistRanking(room);
      break;
    case 'reveal':
      showScreen('s-tierlist-reveal');
      renderTierlistReveal(room);
      break;
    case 'vote':
      showScreen('s-tierlist-vote');
      renderTierlistVote(room);
      break;
    case 'result':
      showScreen('s-tierlist-result');
      renderTierlistResult(room);
      break;
    case 'champion':
      showScreen('s-tierlist-result');
      renderTierlistResult(room);
      document.getElementById('tl-result-winner').textContent = `👑 ${tl.winner?.[0]} a atteint 10 points — CHAMPION !`;
      if(document.getElementById('tl-next-btn')) document.getElementById('tl-next-btn').style.display='none';
      break;
  }
}

const Voice = {
  active: false,         // joined voice?
  muted: false,          // my mic muted?
  stream: null,          // my MediaStream
  peers: {},             // name -> { pc, gainNode, audioEl, muted, speaking }
  vuInterval: null,
  analyser: null,
  vuSource: null,
  selectedDeviceId: '',
  panelOpen: false,
  remoteMuted: {},       // name -> bool (locally muted by me)
  remoteVolume: {},      // name -> 0..2 float
};

// ── Helpers ────────────────────────────────────────────

function voiceIsInGame(){
  const s = document.querySelector('.screen.active')?.id;
  return ['s-lobby','s-reveal','s-waiting','s-playing','s-spectator','s-result'].includes(s);
}

function voiceShowBtn(show){
  const btn = document.getElementById('voice-btn');
  btn.classList.toggle('visible', show);
}

function voiceUpdateBtn(){
  const btn = document.getElementById('voice-btn');
  if(Voice.active && !Voice.muted) btn.className='on visible';
  else if(Voice.active && Voice.muted) btn.className='on visible'; // still on, just muted
  else btn.className='off visible';
  // speaking anim
  if(Voice.speaking) btn.classList.add('speaking');
  btn.textContent = Voice.active ? (Voice.muted ? '🔇' : '🎙️') : '🎙️';
}

function toggleVoicePanel(){
  const panel = document.getElementById('voice-panel');
  Voice.panelOpen = !Voice.panelOpen;
  panel.classList.toggle('show', Voice.panelOpen);
  if(Voice.panelOpen){ voiceLoadDevices(); voiceRenderPanel(); }
}

// ── Device list ────────────────────────────────────────

async function voiceLoadDevices(){
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter(d => d.kind === 'audioinput');
    const sel = document.getElementById('vp-mic-select');
    sel.innerHTML = mics.length
      ? mics.map(d => `<option value="${d.deviceId}" ${d.deviceId===Voice.selectedDeviceId?'selected':''}>${d.label||'Micro '+(mics.indexOf(d)+1)}</option>`).join('')
      : '<option value="">Aucun micro détecté</option>';
  } catch(e){ console.warn('voiceLoadDevices', e); }
}

async function changeMic(deviceId){
  Voice.selectedDeviceId = deviceId;
  if(!Voice.active) return;
  // Restart stream with new device
  await voiceGetStream();
  // Replace track in all peers
  const track = Voice.stream?.getAudioTracks()[0];
  if(!track) return;
  for(const [, peer] of Object.entries(Voice.peers)){
    const sender = peer.pc?.getSenders().find(s => s.track?.kind === 'audio');
    if(sender) sender.replaceTrack(track).catch(()=>{});
  }
  toast('Micro changé ✓','ok');
}

async function voiceGetStream(){
  if(Voice.stream){ Voice.stream.getTracks().forEach(t=>t.stop()); Voice.stream=null; }
  try {
    const constraints = { audio: Voice.selectedDeviceId
      ? { deviceId: { exact: Voice.selectedDeviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      : { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    };
    Voice.stream = await navigator.mediaDevices.getUserMedia(constraints);
    // Mute state
    Voice.stream.getAudioTracks().forEach(t => t.enabled = !Voice.muted);
    // Reload device list (labels now available after permission)
    voiceLoadDevices();
    // VU meter
    voiceStartVU();
    return true;
  } catch(e){
    toast('Micro inaccessible : '+(e.name||e),'err');
    return false;
  }
}

// ── VU meter (my mic) ──────────────────────────────────

function voiceStartVU(){
  if(!AC || !Voice.stream) return;
  if(Voice.analyser) voiceStopVU();
  try {
    Voice.analyser = AC.createAnalyser();
    Voice.analyser.fftSize = 512;
    Voice.vuSource = AC.createMediaStreamSource(Voice.stream);
    Voice.vuSource.connect(Voice.analyser);
    const buf = new Uint8Array(Voice.analyser.frequencyBinCount);
    const fill = document.getElementById('vp-vu-fill');
    Voice.vuInterval = setInterval(()=>{
      if(!Voice.analyser) return;
      Voice.analyser.getByteFrequencyData(buf);
      const avg = buf.reduce((a,b)=>a+b,0)/buf.length;
      const pct = Math.min(100, avg * 2.5);
      if(fill) fill.style.width = pct + '%';
      const speaking = pct > 8 && !Voice.muted;
      if(speaking !== Voice.speaking){
        Voice.speaking = speaking;
        voiceUpdateBtn();
      }
    }, 60);
  } catch(e){ console.warn('VU', e); }
}

function voiceStopVU(){
  clearInterval(Voice.vuInterval); Voice.vuInterval = null;
  try { Voice.vuSource?.disconnect(); } catch{}
  Voice.analyser = null; Voice.vuSource = null;
}

// ── Join / Leave ───────────────────────────────────────

async function joinVoice(){
  if(Voice.active){ leaveVoice(); return; }
  const ok = await voiceGetStream();
  if(!ok) return;
  Voice.active = true;
  Voice.muted = false;
  socket.emit('rtc:ready');
  voiceUpdateBtn();
  voiceRenderPanel();
  toast('Vocal activé 🎙️','ok');
}

function leaveVoice(){
  if(!Voice.active) return;
  socket.emit('rtc:leave');
  // Close all peer connections
  for(const [name] of Object.entries(Voice.peers)) voiceClosePeer(name);
  Voice.peers = {};
  voiceStopVU();
  if(Voice.stream){ Voice.stream.getTracks().forEach(t=>t.stop()); Voice.stream=null; }
  Voice.active = false;
  Voice.speaking = false;
  voiceUpdateBtn();
  voiceRenderPanel();
  toast('Vocal désactivé','warn');
}

function toggleMyMic(){
  if(!Voice.active){ joinVoice(); return; }
  Voice.muted = !Voice.muted;
  if(Voice.stream) Voice.stream.getAudioTracks().forEach(t => t.enabled = !Voice.muted);
  voiceUpdateBtn();
  voiceRenderPanel();
  toast(Voice.muted ? '🔇 Micro coupé' : '🎙️ Micro activé');
}

// ── Peer connections ───────────────────────────────────

function voiceGetOrCreatePeer(remoteName){
  if(Voice.peers[remoteName]) return Voice.peers[remoteName];
  const pc = new RTCPeerConnection(STUN);
  const peer = { pc, gainNode: null, audioEl: null, muted: false, speaking: false };
  Voice.peers[remoteName] = peer;

  // Add my tracks
  if(Voice.stream) Voice.stream.getTracks().forEach(t => pc.addTrack(t, Voice.stream));

  // Remote track → audio element with GainNode
  pc.ontrack = (e) => {
    if(peer.audioEl) return; // already set up
    const ctx = AC || new AudioContext();
    const src = ctx.createMediaStreamSource(new MediaStream([e.track]));
    const gain = ctx.createGain();
    gain.gain.value = Voice.remoteVolume[remoteName] ?? 1.0;
    src.connect(gain); gain.connect(ctx.destination);
    peer.gainNode = gain;
    // Also feed a muted audio element for browser autoplay compat
    const el = new Audio();
    el.srcObject = new MediaStream([e.track]);
    el.muted = true; // we use Web Audio instead
    el.play().catch(()=>{});
    peer.audioEl = el;
    // Apply local mute
    gain.gain.value = (Voice.remoteMuted[remoteName] || peer.muted) ? 0 : (Voice.remoteVolume[remoteName] ?? 1.0);
    // Speaking detection on remote
    voiceWatchRemoteSpeaking(remoteName, e.track);
    voiceRenderPanel();
  };

  pc.onicecandidate = (e) => {
    if(e.candidate) socket.emit('rtc:ice', { to: remoteName, candidate: e.candidate });
  };

  pc.onconnectionstatechange = () => {
    if(['failed','disconnected','closed'].includes(pc.connectionState)){
      voiceClosePeer(remoteName);
      voiceRenderPanel();
    }
  };

  return peer;
}

function voiceClosePeer(name){
  const peer = Voice.peers[name];
  if(!peer) return;
  try { peer.pc?.close(); } catch{}
  try { peer.audioEl?.pause(); } catch{}
  delete Voice.peers[name];
}

async function voiceCallPeer(remoteName){
  if(!Voice.active || !Voice.stream) return;
  const peer = voiceGetOrCreatePeer(remoteName);
  try {
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    socket.emit('rtc:offer', { to: remoteName, offer });
  } catch(e){ console.warn('voiceCallPeer', e); }
}

// Remote speaking detection
function voiceWatchRemoteSpeaking(name, track){
  if(!AC) return;
  try {
    const src = AC.createMediaStreamSource(new MediaStream([track]));
    const an = AC.createAnalyser(); an.fftSize = 256;
    src.connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    setInterval(()=>{
      an.getByteFrequencyData(buf);
      const avg = buf.reduce((a,b)=>a+b,0)/buf.length;
      const speaking = avg > 6;
      if(Voice.peers[name] && speaking !== Voice.peers[name].speaking){
        Voice.peers[name].speaking = speaking;
        // update ring in panel
        const ring = document.querySelector(`[data-peer="${name}"] .vp-speaking-ring`);
        if(ring) ring.classList.toggle('active', speaking);
      }
    }, 80);
  } catch{}
}

// ── Render panel ───────────────────────────────────────

function voiceRenderPanel(){
  if(!Voice.panelOpen) return;
  const dot = document.getElementById('vp-dot');
  dot.classList.toggle('live', Voice.active);

  // Me row
  const myMic = document.getElementById('vp-me-mic');
  const myLbl = document.getElementById('vp-me-label');
  if(Voice.active){
    myMic.className = 'vp-me-mic ' + (Voice.muted ? 'muted' : 'on');
    myMic.textContent = Voice.muted ? '🔇' : '🎙️';
    myLbl.textContent = Voice.muted ? 'Micro coupé' : 'Micro actif';
  } else {
    myMic.className = 'vp-me-mic off';
    myMic.textContent = '🎙️';
    myLbl.textContent = 'Micro désactivé';
  }

  // Join/leave button
  const joinBtn = document.getElementById('vp-join-btn');
  joinBtn.style.display = Voice.active ? 'none' : 'flex';

  // Peers
  const room = _lastRoom;
  const players = room?.players || {};
  const names = Object.keys(players).filter(n => !players[n].isSpectator && n !== S.name);
  const EMOJIS_REF = ['🐉','⚔️','🌊','🔥','⚡','🌙','🎯','🗡️','🛡️','✨','👁️','🐺','🌸','💫','🦊','🗿','🌀','🦋','🔮','🎪'];
  const allNames = Object.keys(players).filter(n => !players[n].isSpectator);

  document.getElementById('vp-peers').innerHTML = names.map(n => {
    const peer = Voice.peers[n];
    const connected = !!peer?.gainNode;
    const speaking = peer?.speaking || false;
    const localMuted = Voice.remoteMuted[n] || false;
    const vol = Voice.remoteVolume[n] ?? 1.0;
    const idx = allNames.indexOf(n);
    const emoji = EMOJIS_REF[idx % EMOJIS_REF.length];
    return `<div class="vp-peer" data-peer="${n}">
      <div class="vp-peer-em">${emoji}<div class="vp-speaking-ring ${speaking?'active':''}"></div></div>
      <div class="vp-peer-info">
        <div class="vp-peer-name">${n}</div>
        <div class="vp-peer-status">${connected ? (speaking?'🔊 parle…':'connecté') : (Voice.active?'en attente…':'hors vocal')}</div>
      </div>
      <div class="vp-peer-vol">
        <button class="vp-mute-btn ${localMuted?'muted':''}" onclick="voiceToggleRemoteMute('${n}')" title="${localMuted?'Réactiver':'Couper'}">${localMuted?'🔇':'🔊'}</button>
        <input type="range" class="vp-vol-slider" min="0" max="200" value="${Math.round(vol*100)}" oninput="voiceSetRemoteVolume('${n}',this.value)" title="Volume ${n}" ${!connected?'disabled':''}>
      </div>
    </div>`;
  }).join('') || `<div style="padding:14px 16px;font-family:var(--fm);font-size:11px;color:var(--muted)">Rejoins le vocal pour parler avec les autres.</div>`;
}

function voiceToggleRemoteMute(name){
  Voice.remoteMuted[name] = !Voice.remoteMuted[name];
  const peer = Voice.peers[name];
  if(peer?.gainNode) peer.gainNode.gain.value = Voice.remoteMuted[name] ? 0 : (Voice.remoteVolume[name] ?? 1.0);
  voiceRenderPanel();
}

function voiceSetRemoteVolume(name, val){
  const v = parseInt(val) / 100;
  Voice.remoteVolume[name] = v;
  const peer = Voice.peers[name];
  if(peer?.gainNode && !Voice.remoteMuted[name]) peer.gainNode.gain.value = v;
}

// ── Socket events (WebRTC signaling) ──────────────────

function voiceBindSocket(){
  // Someone else joined voice — they'll call us if we're already active
  socket.on('rtc:peer_joined', async ({ name }) => {
    if(!Voice.active) return;
    // We call the new peer
    await voiceCallPeer(name);
    voiceRenderPanel();
  });

  socket.on('rtc:peer_left', ({ name }) => {
    voiceClosePeer(name);
    voiceRenderPanel();
  });

  socket.on('rtc:offer', async ({ from, offer }) => {
    if(!Voice.active || !Voice.stream) return;
    const peer = voiceGetOrCreatePeer(from);
    try {
      await peer.pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      socket.emit('rtc:answer', { to: from, answer });
    } catch(e){ console.warn('rtc:offer handler', e); }
  });

  socket.on('rtc:answer', async ({ from, answer }) => {
    const peer = Voice.peers[from];
    if(!peer) return;
    try {
      await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch(e){ console.warn('rtc:answer handler', e); }
  });

  socket.on('rtc:ice', async ({ from, candidate }) => {
    const peer = Voice.peers[from];
    if(!peer || !candidate) return;
    try {
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch(e){ console.warn('rtc:ice', e); }
  });
}

// ── Integration with game screens ─────────────────────

// Show voice button when in game screens
const _origShowScreen = showScreen;
function showScreen(id){
  _origShowScreen(id);
  const gameScreens = ['s-lobby','s-reveal','s-waiting','s-playing','s-spectator','s-result'];
  voiceShowBtn(gameScreens.includes(id));
}

// Leave voice on room leave / reset
const _origLeaveRoom = leaveRoom;
function leaveRoom(){
  leaveVoice();
  _origLeaveRoom();
}


// ── UTILS ──
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active');window.scrollTo(0,0);}
function setLoading(on,text='CHARGEMENT'){document.getElementById('loading').classList.toggle('show',on);if(text)document.getElementById('l-text').textContent=text;}
let _tt;
function toast(msg,type=''){const el=document.getElementById('toast');el.textContent=msg;el.className='toast show'+(type?' '+type:'');clearTimeout(_tt);_tt=setTimeout(()=>el.classList.remove('show'),3200);}
function resetState(){S={name:null,code:null,isHost:false,myAssignment:null,cardFlipped:false,genre:'shonen',subPhase:'words'};_lastRoom=null;_myVote=null;_currentTurnPlayer=null;}
function showRules(){alert("📜 RÈGLES — UNDERCOVER ANIMÉ\n\n👥 RÔLES :\n• Civils → même perso, protégez-vous\n• Undercover → perso similaire, bluffez\n• Mr. White → ne sait rien, survivez\n\n⚠️ RÈGLE CLEF :\nDire le nom de ton perso = éliminé automatiquement !\n\n🎮 CHAQUE TOUR :\n1. Écris 1 mot (timer 45s)\n2. Pointe un suspect 👉\n3. Tout le monde vote\n4. Majorité → éliminé\n\n👁 Tu peux rejoindre en spectateur si la partie a déjà commencé\n\n🏆 Civils éliminent l'imposteur / Undercover survive / Mr. White devine le mot");}

document.getElementById('chips').addEventListener('click',e=>{const c=e.target.closest('.chip');if(!c)return;document.querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));c.classList.add('on');S.genre=c.dataset.g;});

window.addEventListener('load',()=>{
  if(sessionStorage.getItem('uc'))initSocket();
  const u=()=>{if(AC?.state==='suspended')AC.resume();};
  document.addEventListener('touchstart',u,{once:true});
  document.addEventListener('click',u,{once:true});
});
</script>
</body>
</html>
