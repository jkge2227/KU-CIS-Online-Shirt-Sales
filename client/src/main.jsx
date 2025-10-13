import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerLocale, setDefaultLocale } from "react-datepicker";
import th from "date-fns/locale/th";
import { setDefaultOptions } from "date-fns";
import "react-datepicker/dist/react-datepicker.css";

registerLocale("th", th);
setDefaultLocale("th");

setDefaultOptions({ locale: th, weekStartsOn: 1 });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
