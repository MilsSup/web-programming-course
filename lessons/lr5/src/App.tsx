import Task4 from './tasks/Task4';

import { Auth } from '@course/auth-component';

function App() {
  return (
    <Auth>
      {<Task4 />}
    </Auth>
  )
}

export default App;
