/* CHIZ — cart, drawer and small UI touches. No dependencies. */
(() => {
  "use strict";

  const IG_DM = "https://ig.me/m/chiz_thing";
  const STORAGE_KEY = "chiz-cart-v1";
  const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

  const toFa = (value) => String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
  const money = (value) => toFa(Number(value).toLocaleString("en-US"));
  const toman = (value) => `${money(value)} تومان`;

  /* ---------------------------------------------------------------- products */

  const products = new Map();
  document.querySelectorAll("[data-product]").forEach((card) => {
    const img = card.querySelector(".card-media img");
    products.set(card.dataset.id, {
      id: card.dataset.id,
      name: card.dataset.name,
      price: Number(card.dataset.price),
      stock: Number(card.dataset.stock),
      img: img ? img.getAttribute("src") : "",
      card,
    });
  });

  /* ------------------------------------------------------------------- state */

  let cart = load();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((row) => row && products.has(row.id) && Number(row.qty) > 0)
        .map((row) => {
          const product = products.get(row.id);
          return { id: row.id, qty: Math.min(Number(row.qty), product.stock) };
        });
    } catch {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      /* private mode — the cart still works for this visit */
    }
  }

  function lines() {
    return cart
      .map((row) => ({ ...row, product: products.get(row.id) }))
      .filter((row) => row.product);
  }

  function totals() {
    const rows = lines();
    return {
      rows,
      count: rows.reduce((sum, row) => sum + row.qty, 0),
      price: rows.reduce((sum, row) => sum + row.qty * row.product.price, 0),
    };
  }

  /* ------------------------------------------------------------------ drawer */

  const drawer = document.getElementById("cart");
  const scrim = document.getElementById("scrim");
  const cartBtn = document.getElementById("cart-open");
  const closeBtn = document.getElementById("cart-close");
  const list = document.getElementById("cart-list");
  const empty = document.getElementById("cart-empty");
  const totalEl = document.getElementById("cart-total");
  const checkoutBtn = document.getElementById("checkout");
  const clearBtn = document.getElementById("clear-cart");
  const countEl = document.getElementById("cart-count");
  const toastEl = document.getElementById("toast");

  let lastFocus = null;
  let toastTimer = 0;

  function openCart() {
    lastFocus = document.activeElement;
    drawer.classList.add("is-open");
    drawer.removeAttribute("inert");
    drawer.setAttribute("aria-hidden", "false");
    scrim.classList.add("is-open");
    cartBtn.setAttribute("aria-expanded", "true");
    document.body.classList.add("is-locked");
    closeBtn.focus();
  }

  function closeCart() {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    drawer.setAttribute("inert", "");
    scrim.classList.remove("is-open");
    cartBtn.setAttribute("aria-expanded", "false");
    document.body.classList.remove("is-locked");
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus({ preventScroll: true });
    }
  }

  function isOpen() {
    return drawer.classList.contains("is-open");
  }

  /* ------------------------------------------------------------------- toast */

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("is-on");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove("is-on"), 3200);
  }

  /* ------------------------------------------------------------------- render */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function render() {
    const { rows, count, price } = totals();

    countEl.textContent = toFa(count);
    countEl.dataset.empty = count === 0 ? "true" : "false";

    totalEl.textContent = toman(price);
    checkoutBtn.disabled = rows.length === 0;
    clearBtn.hidden = rows.length === 0;
    empty.hidden = rows.length > 0;
    list.hidden = rows.length === 0;

    list.replaceChildren();

    rows.forEach(({ product, qty }) => {
      const item = el("li", "cart-item");
      item.dataset.id = product.id;

      const thumb = el("img", "cart-thumb");
      thumb.src = product.img;
      thumb.alt = "";
      thumb.width = 56;
      thumb.height = 56;

      const info = el("div", "cart-info");
      info.append(
        el("p", "cart-name", product.name),
        el("p", "cart-price", toman(product.price * qty))
      );

      const qtyBox = el("div", "qty");
      const dec = el("button", "", "−");
      dec.type = "button";
      dec.dataset.act = "dec";
      dec.setAttribute("aria-label", `کم کردن ${product.name}`);

      const value = el("output", "", toFa(qty));
      value.setAttribute("aria-label", "تعداد");

      const inc = el("button", "", "+");
      inc.type = "button";
      inc.dataset.act = "inc";
      inc.setAttribute("aria-label", `افزودن ${product.name}`);

      qtyBox.append(dec, value, inc);
      info.append(qtyBox);

      const remove = el("button", "cart-remove", "×");
      remove.type = "button";
      remove.dataset.act = "remove";
      remove.setAttribute("aria-label", `حذف ${product.name} از سبد`);

      item.append(thumb, info, remove);
      list.append(item);
    });
  }

  function bumpCount() {
    countEl.classList.remove("is-bump");
    void countEl.offsetWidth;
    countEl.classList.add("is-bump");
  }

  /* -------------------------------------------------------------------- cart */

  function add(id) {
    const product = products.get(id);
    if (!product) return;

    const row = cart.find((item) => item.id === id);
    const current = row ? row.qty : 0;

    if (current >= product.stock) {
      toast(`از «${product.name}» بیشتر از ${toFa(product.stock)} عدد در باجه نیست.`);
      return;
    }

    if (row) row.qty += 1;
    else cart.push({ id, qty: 1 });

    save();
    render();
    bumpCount();
    toast(`«${product.name}» به سبد اضافه شد.`);
  }

  function changeQty(id, delta) {
    const row = cart.find((item) => item.id === id);
    const product = products.get(id);
    if (!row || !product) return;

    const next = row.qty + delta;
    if (next > product.stock) {
      toast(`موجودی باجه ${toFa(product.stock)} عدد است.`);
      return;
    }

    if (next < 1) {
      remove(id);
      return;
    }

    row.qty = next;
    save();
    render();
  }

  function remove(id) {
    const row = cart.find((item) => item.id === id);
    if (!row) return;
    const name = products.get(id) ? products.get(id).name : "کالا";
    cart = cart.filter((item) => item.id !== id);
    save();
    render();
    toast(`«${name}» از سبد برداشته شد.`);
  }

  function clear() {
    if (!cart.length) return;
    cart = [];
    save();
    render();
    toast("سبد خالی شد.");
  }

  /* ---------------------------------------------------------------- checkout */

  function orderText(rows, price) {
    const out = ["سلام چیز 👋", "این سفارش را از سایت ثبت می‌کنم:", ""];
    rows.forEach(({ product, qty }) => {
      out.push(`• ${product.name} × ${toFa(qty)} — ${toman(product.price * qty)}`);
    });
    out.push("", `جمع سبد: ${toman(price)}`, "", "ممنون!");
    return out.join("\n");
  }

  function copySync(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.insetBlockStart = "-1000px";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }

  async function copyText(text) {
    if (copySync(text)) return true;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  async function checkout() {
    const { rows, price } = totals();
    if (!rows.length) return;

    const text = orderText(rows, price);
    const copied = copyText(text); // starts inside the click gesture

    const win = window.open(IG_DM, "_blank");
    if (win) win.opener = null;

    const ok = await copied;
    if (ok) {
      toast("متن سفارش کپی شد؛ فقط در دایرکت بفرستش.");
    } else {
      toast("اینستاگرام باز شد؛ متن سفارش را از سبد کپی کن.");
    }
  }

  /* ------------------------------------------------------------------ events */

  cartBtn.addEventListener("click", openCart);
  closeBtn.addEventListener("click", closeCart);
  scrim.addEventListener("click", closeCart);
  checkoutBtn.addEventListener("click", checkout);
  clearBtn.addEventListener("click", clear);

  document.querySelectorAll("[data-open-cart]").forEach((btn) => {
    btn.addEventListener("click", openCart);
  });

  document.querySelectorAll("[data-close-cart]").forEach((link) => {
    link.addEventListener("click", closeCart);
  });

  document.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest("[data-product]");
      if (!card) return;
      add(card.dataset.id);

      const label = btn.querySelector("span:first-child");
      const plus = btn.querySelector(".plus");
      if (!label || !plus) return;
      btn.classList.add("is-added");
      label.textContent = "اضافه شد";
      plus.textContent = "✓";
      window.setTimeout(() => {
        btn.classList.remove("is-added");
        label.textContent = "افزودن به سبد";
        plus.textContent = "+";
      }, 1100);
    });
  });

  list.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-act]");
    if (!btn) return;
    const item = btn.closest(".cart-item");
    if (!item) return;

    const { id } = item.dataset;
    if (btn.dataset.act === "inc") changeQty(id, 1);
    if (btn.dataset.act === "dec") changeQty(id, -1);
    if (btn.dataset.act === "remove") remove(id);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) {
      closeCart();
      return;
    }

    if (event.key !== "Tab" || !isOpen()) return;

    const focusable = drawer.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  /* ------------------------------------------------------------------ reveal */

  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" }
    );
    reveals.forEach((item) => io.observe(item));
  } else {
    reveals.forEach((item) => item.classList.add("is-in"));
  }

  render();
})();
