// Host file for an ordinary web page: saving a file is a temporary download link.
const HOST = {
  fileSaver: async () => ({
    save: async ({ filename, data }) => {
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    },
  }),
};
