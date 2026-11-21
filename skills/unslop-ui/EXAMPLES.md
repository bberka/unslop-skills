<!-- unslop-ignore-file -->
# Before and after

Read these when unsure how far to cut. Each pair cuts to what the source already says and adds nothing. The last three are product tells, where the after is a proposal and no file changes until the user agrees.

## Hero with eyebrow (ui-7, ui-44, ui-48)

Before:
```html
<p class="text-xs uppercase tracking-widest text-indigo-500">Introducing Ledger</p>
<h1>Finance. Simplified. Finally.</h1>
<p>The all-in-one platform that helps modern teams seamlessly manage their money — without the hassle.</p>
```

After:
```html
<h1>Manage your team's money</h1>
```

The eyebrow goes. The slogan becomes the one thing the old subtitle said, and the subtitle goes because without "all-in-one" and "seamlessly" it repeats the heading. If a feature list on the same page names card controls and receipt capture, the heading may use those words. It may not use a number or a feature that appears nowhere in the source.

## Numbered feature (ui-7, ui-45)

Before:
```jsx
<span className="font-mono text-sm">01 //</span>
<h3>Smart sync</h3>
<p>Our smart sync feature automatically keeps your files in sync across all of your devices.</p>
```

After:
```jsx
<h3>Smart sync</h3>
<p>Your files stay in sync across your devices.</p>
```

The features have no real order, so the number goes. The description keeps only the fact the title doesn't give.

## Card that explains itself (ui-45, ui-46)

Before:
```jsx
<Card>
  <CardTitle>Recent activity</CardTitle>
  <CardDescription>This card shows your most recent activity across the workspace (updates in real time).</CardDescription>
  <ActivityList />
</Card>
```

After:
```jsx
<Card>
  <CardTitle>Recent activity</CardTitle>
  <ActivityList />
</Card>
```

If `CardDescription` is now unused, its import goes too.

## Status line (ui-7, ui-49)

Before:
```jsx
<div className="flex items-center gap-2 text-xs">
  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
  Live · 3 agents · Synced · v2.4.1 · Updated just now
</div>
```

After, when nothing in the app tracks a live connection:
```jsx
<p className="text-xs">3 agents</p>
```

If the dot is bound to a real connection state, keep it with an `aria-label` and drop the word "Live".

## Badge with and without state (ui-22)

```jsx
<h3>Exports <Badge>New</Badge></h3>
{plan.isBeta && <Badge>Beta</Badge>}
```

The first badge always renders with fixed text, so it goes. The second renders from `plan.isBeta`, so it is a `keep` entry.

## KPI tile (ui-6, ui-52)

Before:
```jsx
<Tile>
  <span>💰 Total revenue</span>
  <strong>$48,200</strong>
  <span className="text-green-600">▲ 12% up</span>
  <p>Revenue grew 12% compared to last month, showing strong momentum.</p>
</Tile>
```

After:
```jsx
<Tile>
  <span>Revenue</span>
  <strong>$48,200</strong>
  <span className="text-green-600">▲ 12% vs last month</span>
</Tile>
```

"vs last month" is the one fact from the deleted sentence that the tile didn't already show.

## Chart header, scaffolding, and legend (ui-50, ui-51, ui-53, ui-54)

Before:
```js
title: { text: "Line chart of weekly active users" },
subtitle: { text: "Each point represents one week. Hover over a point to see the exact value." },
plugins: { legend: { display: true, position: "bottom" } },
scales: { y: { grid: { color: "#9ca3af", lineWidth: 2 }, border: { display: true, width: 2 } } },
```

After:
```js
title: { text: "Weekly active users" },
plugins: {
  legend: { display: false },
  // Name each line at its last point instead of in a legend.
  datalabels: { display: (ctx) => ctx.dataIndex === ctx.dataset.data.length - 1, formatter: (v, ctx) => `${ctx.dataset.label} ${v}` },
},
scales: { y: { grid: { color: "#eeeeee", lineWidth: 1 }, border: { display: false } } },
```

Same chart type, data, and series colors. The gridlines become hairlines, the axis border goes, and the legend becomes labels at the line ends.

## Form field (ui-47)

Before:
```html
<label>Email address</label>
<input placeholder="Enter your email address" />
<small>We'll use this email address to contact you.</small>

<label>Password</label>
<input type="password" placeholder="Enter your password" />
<small>At least 12 characters.</small>
```

After:
```html
<label for="email">Email</label>
<input id="email" type="email" />

<label for="password">Password</label>
<input id="password" type="password" />
<small>At least 12 characters.</small>
```

The visible labels stay and are tied to their inputs. The placeholders repeated the labels. The first helper text restated the label; the second is a constraint the user can't guess.

## Empty state (ui-45, ui-20)

Before:
```jsx
<EmptyState title="Oops! Nothing here yet 👀" description="It looks like you haven't created any projects yet. Get started by creating your very first project!" />
```

After:
```jsx
<EmptyState title="No projects" description="Create a project to see it here." />
```

## Claim you can't verify (ui-8)

```html
<p>Trusted by 10,000+ teams</p>
<blockquote>"Ledger cut our month-end close in half." Sarah Chen, CFO at Northwind</blockquote>
```

Leave both and record each as a `propose` entry: "confirm the number or remove", "confirm this is a real customer quote or remove". Whether they are true is not in the code.

## Account menu (ui-55)

```jsx
<DropdownMenuLabel>{user.name}<small>{user.email}</small></DropdownMenuLabel>
<DropdownMenuItem>Profile</DropdownMenuItem>
<DropdownMenuItem>Help</DropdownMenuItem>
<DropdownMenuItem>Log out</DropdownMenuItem>
```

The app has one account per user, and a help icon sits in the header beside this menu. Proposals: "Remove the email from the menu label; there is no second account to tell apart" and "Remove the Help item; the header's help icon opens the same page". The model stores `user.away`, so a third proposal may name it: "Add an away toggle bound to `user.away`". Without that field, the proposals stop at the removals.

## Due date (ui-56)

Before:
```html
<select name="dueDay"></select>
<select name="dueMonth"></select>
<select name="dueYear"></select>
```

Proposed, when the project has no date picker of its own:
```html
<label for="due">Due date</label>
<input id="due" type="date" />
```

The same three selects on a date-of-birth field are a `keep` entry.

## Entity names on a detail page (ui-58)

Before:
```jsx
<dt>Project</dt><dd>{task.project.name}</dd>
<dt>Owner</dt><dd>{task.owner.name}</dd>
```

Proposed, because the router defines `/projects/:id` and `/members/:id`:
```jsx
<dt>Project</dt><dd><Link to={`/projects/${task.project.id}`}>{task.project.name}</Link></dd>
<dt>Owner</dt><dd><Link to={`/members/${task.owner.id}`}>{task.owner.name}</Link></dd>
```

A name with no route behind it stays text.

