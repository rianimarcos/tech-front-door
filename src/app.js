(() => {
  const form = document.getElementById('intake');
  const steps = Array.from(document.querySelectorAll('.step[data-step]'));
  const stepperItems = document.querySelectorAll('#stepper li');
  const backBtn = document.getElementById('back');
  const nextBtn = document.getElementById('next');
  const submitBtn = document.getElementById('submit');
  const stepLabel = document.getElementById('stepLabel');

  const MAX_FILES = 5;
  const MAX_BYTES = 10 * 1024 * 1024;
  const SCROLL_TOLERANCE = 4;
  const REVIEW_END_MARKER_ID = 'review-end-marker';

  const isReviewStep = (step) => !!step?.querySelector('#review');
  const isDoneStep = (step) => step?.dataset.step === 'DONE';
  let reviewScrollUnlocked = false;
  let reviewScrollInteracted = false;
  let reviewStartScrollY = 0;

  const currentValuesFor = (name) => {
    const input = form.elements[name];
    if (!input) return [];
    if (input instanceof RadioNodeList || input instanceof NodeList) {
      const nodes = Array.from(input);
      const type = nodes[0]?.type;
      if (type === 'checkbox')
        return nodes.filter((n) => n.checked).map((n) => n.value);
      if (type === 'radio') {
        const chosen = nodes.find((n) => n.checked);
        return chosen ? [chosen.value] : [];
      }
      return nodes.map((n) => n.value).filter(Boolean);
    }
    return input.value ? [input.value] : [];
  };

  const firstControlFor = (name) => {
    const el = form.elements[name];
    if (!el) return null;
    return el instanceof RadioNodeList || el instanceof NodeList ? el[0] : el;
  };

  const readValue = (name) => {
    const el = form.elements[name];
    if (!el) return '';
    if (el instanceof RadioNodeList || el instanceof NodeList) {
      const nodes = Array.from(el);
      if (nodes[0].type === 'checkbox')
        return nodes
          .filter((n) => n.checked)
          .map((n) => n.value)
          .join(', ');
      if (nodes[0].type === 'radio')
        return nodes.find((n) => n.checked)?.value || '';
      return nodes
        .map((n) => n.value)
        .filter(Boolean)
        .join(' · ');
    }
    if (el.type === 'file')
      return Array.from(el.files || [])
        .map((f) => f.name)
        .join(', ');
    return el.value || '';
  };

  const matchesRule = (raw) => {
    try {
      const rule = JSON.parse(raw);
      return Object.entries(rule).every(([name, expected]) => {
        const arr = Array.isArray(expected) ? expected : [expected];
        return currentValuesFor(name).some((v) => arr.includes(v));
      });
    } catch {
      return true;
    }
  };

  const stepIsActive = (step) =>
    !step.dataset.activeWhen || matchesRule(step.dataset.activeWhen);

  const activeOrder = () =>
    steps
      .filter((s) => !isDoneStep(s) && stepIsActive(s))
      .map((s) => s.dataset.step);

  let current = activeOrder()[0];

  const setStep = (target) => {
    const order = activeOrder();
    if (!order.includes(target)) target = order[0];
    current = target;
    steps.forEach((s) =>
      s.classList.toggle('is-active', s.dataset.step === target),
    );
    const idx = order.indexOf(target);
    stepperItems.forEach((li) => {
      const s = li.dataset.step;
      li.classList.remove('is-active', 'is-done', 'is-hidden');
      if (!order.includes(s)) {
        li.classList.add('is-hidden');
        return;
      }
      const i = order.indexOf(s);
      if (i === idx) li.classList.add('is-active');
      else if (i < idx) li.classList.add('is-done');
    });
    backBtn.disabled = idx === 0;
    const isLast = idx === order.length - 1;
    nextBtn.hidden = isLast;
    submitBtn.hidden = !isLast;
    stepLabel.textContent = `Step ${idx + 1} of ${order.length}`;
    const targetStep = steps.find((s) => s.dataset.step === target);
    if (isReviewStep(targetStep)) {
      reviewScrollUnlocked = false;
      reviewScrollInteracted = false;
      buildReview();
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    reviewStartScrollY = window.scrollY;
    updateSubmitAvailability();
  };

  const setStepDone = () => {
    steps.forEach((s) => s.classList.toggle('is-active', isDoneStep(s)));
    document.querySelector('.nav-bar').style.display = 'none';
    stepperItems.forEach((li) => {
      li.classList.remove('is-active');
      if (!li.classList.contains('is-hidden')) li.classList.add('is-done');
    });
  };

  document.querySelectorAll('[data-count-for]').forEach((el) => {
    const target = document.getElementById(el.dataset.countFor);
    if (!target) return;
    const update = () => {
      el.textContent = target.value.length;
    };
    target.addEventListener('input', update);
    update();
  });

  const conditionals = Array.from(
    document.querySelectorAll('.conditional[data-show-when]'),
  );

  const evaluateConditionals = () => {
    conditionals.forEach((el) => {
      const match = matchesRule(el.dataset.showWhen);
      el.classList.toggle('is-visible', match);
      if (!match) {
        el.querySelectorAll('input, textarea, select').forEach((inp) => {
          if (inp.type === 'checkbox' || inp.type === 'radio')
            inp.checked = false;
          else inp.value = '';
        });
      }
    });
  };
  form.addEventListener('change', evaluateConditionals);
  form.addEventListener('input', evaluateConditionals);
  evaluateConditionals();

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  document.querySelectorAll('.dropzone').forEach((zone) => {
    const input = zone.querySelector('input[type="file"]');
    const list = document.getElementById(`${input.id}_list`);
    const dropText = zone.querySelector('.drop-text');
    let files = [];
    let errorMsg = '';

    const syncInput = () => {
      const dt = new DataTransfer();
      files.forEach((f) => dt.items.add(f));
      input.files = dt.files;
    };

    const render = () => {
      if (!list) return;
      list.innerHTML = '';
      files.forEach((f, i) => {
        const li = document.createElement('li');
        const ext = (f.name.split('.').pop() || 'file').toLowerCase();
        const badge = document.createElement('span');
        badge.className = `file-type file-type-${ext}`;
        badge.textContent = ext.toUpperCase();
        const meta = document.createElement('span');
        meta.className = 'file-meta';
        const name = document.createElement('span');
        name.className = 'file-name';
        name.textContent = f.name;
        const size = document.createElement('span');
        size.className = 'file-size';
        size.textContent = formatSize(f.size);
        meta.appendChild(name);
        meta.appendChild(size);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'file-remove';
        btn.setAttribute('aria-label', `Remove ${f.name}`);
        btn.textContent = '×';
        btn.addEventListener('click', () => {
          files.splice(i, 1);
          syncInput();
          render();
        });
        li.appendChild(badge);
        li.appendChild(meta);
        li.appendChild(btn);
        list.appendChild(li);
      });
      if (errorMsg) {
        const li = document.createElement('li');
        li.className = 'file-error';
        li.textContent = `⚠ ${errorMsg}`;
        list.appendChild(li);
      }
      if (dropText) {
        if (!files.length)
          dropText.innerHTML =
            '<strong>Click to upload</strong> or drag and drop';
        else if (files.length === 1)
          dropText.innerHTML =
            '<strong>1 file added</strong>. Click to add more.';
        else
          dropText.innerHTML = `<strong>${files.length} files added</strong>. Click to add more.`;
      }
    };

    const addFiles = (incoming) => {
      errorMsg = '';
      const rejected = [];
      Array.from(incoming).forEach((f) => {
        if (f.size > MAX_BYTES) {
          rejected.push(`${f.name} (over 10 MB)`);
          return;
        }
        if (files.some((x) => x.name === f.name && x.size === f.size)) return;
        if (files.length >= MAX_FILES) {
          rejected.push(f.name);
          return;
        }
        files.push(f);
      });
      if (rejected.length) {
        errorMsg =
          files.length >= MAX_FILES
            ? `You can upload up to ${MAX_FILES} files. Rejected: ${rejected.join(', ')}.`
            : `Rejected: ${rejected.join(', ')}.`;
      }
      syncInput();
      render();
    };

    ['dragenter', 'dragover'].forEach((e) =>
      zone.addEventListener(e, (ev) => {
        ev.preventDefault();
        zone.classList.add('drag');
      }),
    );
    ['dragleave', 'drop'].forEach((e) =>
      zone.addEventListener(e, (ev) => {
        ev.preventDefault();
        zone.classList.remove('drag');
      }),
    );
    zone.addEventListener('drop', (ev) => addFiles(ev.dataTransfer.files));
    input.addEventListener('change', () => addFiles(Array.from(input.files)));

    render();
  });

  const getFieldForControl = (el) => el.closest('.field');

  const getFieldLabel = (field, { keepNumber = false } = {}) => {
    if (!field) return 'this question';
    const label = field.querySelector(':scope > label');
    if (!label) return 'this question';
    let text = label.textContent.replace(/\s*\*\s*$/, '').trim();
    if (!keepNumber) text = text.replace(/^\s*\d+\.\s*/, '');
    return text.replace(/\s+/g, ' ').trim();
  };

  const cleanLabelText = (el) => {
    if (!el) return '';
    const clone = el.cloneNode(true);
    clone.querySelectorAll('.req, .opt').forEach((n) => n.remove());
    return clone.textContent.replace(/\s+/g, ' ').trim();
  };

  const subLabelFor = (control) => {
    if (!control) return '';
    const wrapper = control.closest('.subfield');
    if (wrapper) {
      const lbl = wrapper.querySelector('.sub-label');
      if (lbl) return cleanLabelText(lbl);
    }
    let node = control.previousElementSibling;
    while (node) {
      if (node.classList?.contains('sub-label')) return cleanLabelText(node);
      const nested = node.querySelector?.('.sub-label');
      if (nested) return cleanLabelText(nested);
      node = node.previousElementSibling;
    }
    const parent = control.parentElement;
    if (parent && !parent.classList.contains('field')) {
      let sib = parent.previousElementSibling;
      while (sib) {
        if (sib.classList?.contains('sub-label')) return cleanLabelText(sib);
        sib = sib.previousElementSibling;
      }
    }
    return control.getAttribute('aria-label') || '';
  };

  const fieldNames = (field) => {
    const seen = new Set();
    const out = [];
    field.querySelectorAll('input, textarea, select').forEach((el) => {
      if (!el.name || seen.has(el.name)) return;
      const cond = el.closest('.conditional');
      if (cond && !cond.classList.contains('is-visible')) return;
      seen.add(el.name);
      out.push(el.name);
    });
    return out;
  };

  const isControlVisible = (el) => {
    const cond = el.closest('.conditional');
    return !cond || cond.classList.contains('is-visible');
  };

  const ensureId = (el) => {
    if (!el.id)
      el.id = `f-${el.name || Math.random().toString(36).slice(2, 8)}`;
    return el.id;
  };

  const messageFor = (field, controlType) => {
    const custom = field?.dataset?.error;
    if (custom) return custom;
    if (controlType === 'radio') return 'Please choose an option.';
    if (controlType === 'checkbox') return 'Please select at least one option.';
    if (controlType === 'select-one') return 'Please pick a value.';
    if (controlType === 'email') return 'Please enter a valid email address.';
    return 'Please provide a response.';
  };

  const setFieldError = (field, msg, failingControls) => {
    if (!field) return;
    field.classList.add('has-error');
    field.querySelectorAll('.field-error').forEach((n) => n.remove());

    const err = document.createElement('p');
    err.className = 'field-error';
    err.setAttribute('role', 'alert');
    err.id = `err-${Math.random().toString(36).slice(2, 8)}`;
    err.textContent = msg;

    const controls = failingControls.filter(Boolean);
    controls.forEach((c) => c.setAttribute('aria-invalid', 'true'));

    const last = controls[controls.length - 1];
    const anchor = last?.closest('.choices') || last;
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(err, anchor.nextSibling);
    } else {
      field.appendChild(err);
    }

    controls.forEach((c) => {
      const prev = c.getAttribute('aria-describedby') || '';
      if (!prev.split(' ').includes(err.id)) {
        c.setAttribute('aria-describedby', prev ? `${prev} ${err.id}` : err.id);
      }
    });
  };

  const clearFieldError = (field) => {
    if (!field || !field.classList.contains('has-error')) return;
    field.classList.remove('has-error');
    field.querySelectorAll('.field-error').forEach((n) => n.remove());
    field.querySelectorAll('[aria-invalid="true"]').forEach((el) => {
      el.removeAttribute('aria-invalid');
    });
  };

  const showSummary = (step, items) => {
    let s = step.querySelector(':scope > .error-summary');
    if (!s) {
      s = document.createElement('div');
      s.className = 'error-summary';
      s.setAttribute('role', 'alert');
      s.setAttribute('aria-live', 'assertive');
      s.tabIndex = -1;
      step.insertBefore(s, step.firstChild);
    }
    const heading =
      items.length === 1
        ? '1 question needs your attention'
        : `${items.length} questions need your attention`;
    s.innerHTML = `
      <p class="error-summary-title">${heading}</p>
      <ul>${items
        .map((i) => `<li><a href="#" data-target="${i.id}">${i.label}</a></li>`)
        .join('')}</ul>
    `;
    s.querySelectorAll('a[data-target]').forEach((a) => {
      a.addEventListener('click', (ev) => {
        ev.preventDefault();
        const target = document.getElementById(a.dataset.target);
        target?.focus({ preventScroll: false });
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
    s.focus();
  };

  const clearSummary = (step) => {
    step?.querySelector(':scope > .error-summary')?.remove();
  };

  const isStepComplete = (step) => {
    if (!step || isReviewStep(step) || isDoneStep(step)) return true;

    const checkedGroups = new Set();
    const requiredControls = Array.from(step.querySelectorAll('[required]'));
    for (const el of requiredControls) {
      if (!isControlVisible(el)) continue;
      if (el.type === 'radio' || el.type === 'checkbox') {
        if (checkedGroups.has(el.name)) continue;
        checkedGroups.add(el.name);
        if (!form.querySelector(`[name="${el.name}"]:checked`)) return false;
        continue;
      }
      if (el.type === 'email') {
        if (!el.value.trim() || !el.checkValidity()) return false;
        continue;
      }
      if (!el.value.trim()) return false;
    }

    const requireAnyFields = Array.from(
      step.querySelectorAll('.field[data-require-any]'),
    );
    for (const field of requireAnyFields) {
      const cond = field.closest('.conditional');
      if (cond && !cond.classList.contains('is-visible')) continue;
      const names = field.dataset.requireAny.split(/\s+/).filter(Boolean);
      const anyFilled = names.some((n) =>
        currentValuesFor(n).some((v) => v.trim() !== ''),
      );
      if (!anyFilled) return false;
    }

    return true;
  };

  const isFormCompleteForSubmit = () =>
    activeOrder().every((stepKey) => {
      const step = steps.find((s) => s.dataset.step === stepKey);
      return isStepComplete(step);
    });

  const hasPassedReviewEnd = () => {
    const marker = document.getElementById(REVIEW_END_MARKER_ID);
    if (!marker) return false;
    const navBar = document.querySelector('.nav-bar');
    const navOffset = navBar ? navBar.offsetHeight : 0;
    const visibleBottom = window.innerHeight - navOffset - SCROLL_TOLERANCE;
    return marker.getBoundingClientRect().top <= visibleBottom;
  };

  const updateSubmitAvailability = () => {
    const activeStep = steps.find((s) => s.dataset.step === current);
    if (!activeStep || !isReviewStep(activeStep)) {
      submitBtn.disabled = false;
      submitBtn.removeAttribute('aria-disabled');
      submitBtn.removeAttribute('title');
      return;
    }

    if (
      !reviewScrollInteracted &&
      Math.abs(window.scrollY - reviewStartScrollY) > SCROLL_TOLERANCE
    ) {
      reviewScrollInteracted = true;
    }
    if (
      !reviewScrollUnlocked &&
      reviewScrollInteracted &&
      hasPassedReviewEnd()
    ) {
      reviewScrollUnlocked = true;
    }

    const isReady = isFormCompleteForSubmit() && reviewScrollUnlocked;
    submitBtn.disabled = !isReady;
    submitBtn.setAttribute('aria-disabled', String(!isReady));
    submitBtn.title = isReady
      ? ''
      : 'Complete all required questions and scroll past the final review answer to enable submit.';
  };

  const validateStep = (stepKey) => {
    const step = steps.find((s) => s.dataset.step === stepKey);
    if (!step) return true;
    step.querySelectorAll('.field.has-error').forEach(clearFieldError);
    clearSummary(step);

    const failures = new Map();

    step.querySelectorAll('[required]').forEach((el) => {
      if (!isControlVisible(el)) return;
      const field = getFieldForControl(el);
      if (!field) return;

      if (el.type === 'radio' || el.type === 'checkbox') {
        const firstOfGroup = form.querySelectorAll(`[name="${el.name}"]`)[0];
        if (el !== firstOfGroup) return;
      }

      let bad = false;
      const type = el.type;
      if (el.type === 'radio' || el.type === 'checkbox') {
        bad = !form.querySelector(`[name="${el.name}"]:checked`);
      } else if (el.type === 'email') {
        bad = !el.value.trim() || !el.checkValidity();
      } else {
        bad = !el.value.trim();
      }
      if (bad) {
        if (!failures.has(field)) failures.set(field, { type, controls: [] });
        failures.get(field).controls.push(el);
      }
    });

    step.querySelectorAll('.field[data-require-any]').forEach((field) => {
      const cond = field.closest('.conditional');
      if (cond && !cond.classList.contains('is-visible')) return;
      const names = field.dataset.requireAny.split(/\s+/).filter(Boolean);
      const anyFilled = names.some((n) =>
        currentValuesFor(n).some((v) => v.trim() !== ''),
      );
      if (anyFilled) return;
      const controls = names.map((n) => firstControlFor(n)).filter(Boolean);
      const type = controls[0]?.type || 'text';
      if (!failures.has(field)) failures.set(field, { type, controls });
    });

    const missing = [];
    failures.forEach(({ type, controls }, field) => {
      setFieldError(field, messageFor(field, type), controls);
      missing.push({
        id: ensureId(controls[0]),
        label: getFieldLabel(field),
      });
    });

    if (missing.length) {
      showSummary(step, missing);
      const first = document.getElementById(missing[0].id);
      setTimeout(() => first?.focus({ preventScroll: false }), 0);
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  };

  form.addEventListener('input', (e) =>
    clearFieldError(getFieldForControl(e.target)),
  );
  form.addEventListener('change', (e) =>
    clearFieldError(getFieldForControl(e.target)),
  );
  form.addEventListener('input', updateSubmitAvailability);
  form.addEventListener('change', updateSubmitAvailability);
  window.addEventListener('scroll', updateSubmitAvailability, {
    passive: true,
  });
  window.addEventListener('resize', updateSubmitAvailability);

  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const tag = e.target.tagName;
    if (tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A') return;
    e.preventDefault();
    if (!submitBtn.hidden) submitBtn.click();
    else nextBtn.click();
  });

  nextBtn.addEventListener('click', () => {
    if (!validateStep(current)) return;
    const order = activeOrder();
    const idx = order.indexOf(current);
    if (idx < order.length - 1) setStep(order[idx + 1]);
  });

  backBtn.addEventListener('click', () => {
    const order = activeOrder();
    const idx = order.indexOf(current);
    if (idx > 0) setStep(order[idx - 1]);
  });

  const buildReview = () => {
    const container = document.getElementById('review');
    container.innerHTML = '';
    activeOrder().forEach((stepKey) => {
      const step = steps.find((s) => s.dataset.step === stepKey);
      if (!step || isReviewStep(step)) return;

      const title =
        step.querySelector('.step-head h2')?.textContent?.trim() ||
        `Section ${stepKey}`;

      const card = document.createElement('section');
      card.className = 'review-card';
      const h = document.createElement('h3');
      h.className = 'review-card-title';
      h.textContent = title;
      card.appendChild(h);

      const body = document.createElement('div');
      body.className = 'review-card-body';

      let printed = 0;
      step.querySelectorAll(':scope > .field').forEach((field) => {
        const names = fieldNames(field);
        if (!names.length) return;
        const entries = names
          .map((n) => ({
            name: n,
            value: readValue(n),
            control: firstControlFor(n),
          }))
          .filter((e) => e.value);
        if (!entries.length) return;

        const item = document.createElement('div');
        item.className = 'review-item';

        const q = document.createElement('p');
        q.className = 'review-q';
        const fullLabel = getFieldLabel(field, { keepNumber: true });
        const numMatch = fullLabel.match(/^(\d+)\.\s*(.*)$/);
        if (numMatch) {
          const num = document.createElement('span');
          num.className = 'review-q-num';
          num.textContent = numMatch[1];
          const text = document.createElement('span');
          text.className = 'review-q-text';
          text.textContent = numMatch[2];
          q.appendChild(num);
          q.appendChild(text);
        } else {
          q.textContent = fullLabel;
        }
        item.appendChild(q);

        const a = document.createElement('div');
        a.className = 'review-a';

        const renderFileList = (control, container) => {
          const list = document.createElement('ul');
          list.className = 'review-files';
          Array.from(control.files || []).forEach((f) => {
            const li = document.createElement('li');
            const ext = (f.name.split('.').pop() || 'file').toLowerCase();
            const badge = document.createElement('span');
            badge.className = `file-type file-type-${ext}`;
            badge.textContent = ext.toUpperCase();
            const meta = document.createElement('span');
            meta.className = 'review-file-meta';
            const name = document.createElement('span');
            name.className = 'review-file-name';
            name.textContent = f.name;
            const size = document.createElement('span');
            size.className = 'review-file-size';
            size.textContent = formatSize(f.size);
            meta.appendChild(name);
            meta.appendChild(size);
            li.appendChild(badge);
            li.appendChild(meta);
            list.appendChild(li);
          });
          container.appendChild(list);
        };

        if (entries.length === 1 && entries[0].control?.type === 'file') {
          renderFileList(entries[0].control, a);
        } else if (entries.length === 1 && !subLabelFor(entries[0].control)) {
          a.classList.add('is-single');
          a.textContent = entries[0].value;
        } else {
          entries.forEach(({ value, control }) => {
            const part = document.createElement('div');
            part.className = 'review-part';
            const label = subLabelFor(control);
            if (label) {
              const lbl = document.createElement('span');
              lbl.className = 'review-part-label';
              lbl.textContent = label;
              part.appendChild(lbl);
            }
            if (control?.type === 'file') {
              renderFileList(control, part);
            } else {
              const val = document.createElement('span');
              val.className = 'review-part-value';
              val.textContent = value;
              part.appendChild(val);
            }
            a.appendChild(part);
          });
        }

        item.appendChild(a);
        body.appendChild(item);
        printed++;
      });

      if (!printed) {
        const empty = document.createElement('p');
        empty.className = 'review-empty';
        empty.textContent = 'No answers recorded.';
        body.appendChild(empty);
      }
      card.appendChild(body);
      container.appendChild(card);
    });
    const marker = document.createElement('div');
    marker.id = REVIEW_END_MARKER_ID;
    marker.setAttribute('aria-hidden', 'true');
    marker.style.height = '1px';
    container.appendChild(marker);
  };

  const collectPayload = () => {
    const payload = {};
    activeOrder().forEach((stepKey) => {
      const step = steps.find((s) => s.dataset.step === stepKey);
      if (!step || isReviewStep(step)) return;
      step.querySelectorAll(':scope > .field').forEach((field) => {
        fieldNames(field).forEach((name) => {
          const value = readValue(name);
          if (value) payload[name] = value;
        });
      });
    });
    return payload;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const order = activeOrder();
    for (const step of order) {
      if (!validateStep(step)) {
        setStep(step);
        return;
      }
    }
    const payload = collectPayload();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';
    try {
      console.log('Tech Front Door submission →', payload);
      await new Promise((r) => setTimeout(r, 700));
      setStepDone();
    } catch (err) {
      console.error(err);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit request';
      alert('Submission failed. Please try again.');
    }
  });

  setStep(current);
  updateSubmitAvailability();
})();
