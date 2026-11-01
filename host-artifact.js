// Host file for the claude.ai artifact build only. Artifact pages run in a sandbox that blocks download links;
// the artifact host instead offers named abilities through window.claude.use(name). 'downloads' asks the
// viewer to confirm and then saves the file. Elsewhere this resolves to null and only Copy as text is offered.
const HOST = {
  fileSaver: async () => {
    const api = window.claude;
    return api && api.use ? await api.use('downloads') : null;
  },
};
