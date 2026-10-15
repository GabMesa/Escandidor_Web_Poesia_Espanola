import {applicationState} from './application-state.js';

export function reportEditorLoading(stage,detail='',requestId){
  const progress={stage,detail,requestId};
  applicationState.runtime.editorLoading=progress;
  window.dispatchEvent(new CustomEvent('escandidor:loading-stage',{detail:progress}));
}
