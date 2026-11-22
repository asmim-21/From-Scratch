import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { RecipeBook } from './book/RecipeBook';
import { asset, site } from './lib/content';
import { ServingsProvider } from './lib/servings';
import { TicksProvider } from './lib/ticks';
import './styles/global.css';
import './styles/book.css';
import './styles/pages.css';
import './styles/toolbar.css';
import './styles/cook.css';

// The colours in content/site.yaml
for (const [name, value] of Object.entries(site.colors)) {
  document.documentElement.style.setProperty(`--${name}`, value);
}

if (site.background) {
  const url = new URL(asset(site.background), document.baseURI).href;
  document.documentElement.style.setProperty('--table', `url("${url}")`);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <TicksProvider>
        <ServingsProvider>
          <RecipeBook />
        </ServingsProvider>
      </TicksProvider>
    </HashRouter>
  </StrictMode>,
);
