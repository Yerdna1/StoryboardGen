import React, { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  IconButton,
  Typography,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Stack
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  FolderOpen as LoadIcon
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';

interface PromptsPanelProps {
  selectedPrompt: any;
  onSelectPrompt: (prompt: any) => void;
}

export function PromptsPanel({ selectedPrompt, onSelectPrompt }: PromptsPanelProps) {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [editingPrompt, setEditingPrompt] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showSamplesDialog, setShowSamplesDialog] = useState(false);
  const [samples, setSamples] = useState<any[]>([]);
  const [formData, setFormData] = useState({ title: '', content: '' });

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    if (!window.electronAPI) return;
    const savedPrompts = await window.electronAPI.getPrompts();
    setPrompts(savedPrompts);
  };

  const handleLoadSamples = async () => {
    try {
      // Load sample storyboards from the public/samples directory
      const response = await fetch('/samples/character-journey.json');
      const sampleData = await response.json();

      // Convert sample panels to prompt format
      const panelsText = sampleData.panels
        .map((p: any) => `${p.id}. ${p.description}`)
        .join('\n');

      const newPrompt = {
        id: uuidv4(),
        title: sampleData.name,
        content: panelsText
      };

      await window.electronAPI?.savePrompt(newPrompt);
      loadPrompts();
      onSelectPrompt(newPrompt);
      setShowSamplesDialog(false);
    } catch (error) {
      console.error('Failed to load sample:', error);
    }
  };

  const handleNewPrompt = () => {
    setEditingPrompt(null);
    setFormData({ title: '', content: '' });
    setShowEditDialog(true);
  };

  const handleEditPrompt = (prompt: any) => {
    setEditingPrompt(prompt);
    setFormData({ title: prompt.title, content: prompt.content });
    setShowEditDialog(true);
  };

  const handleSavePrompt = async () => {
    if (!formData.title || !formData.content || !window.electronAPI) return;

    const promptData = {
      id: editingPrompt?.id || uuidv4(),
      title: formData.title,
      content: formData.content
    };

    if (editingPrompt) {
      await window.electronAPI.updatePrompt(promptData.id, promptData);
    } else {
      await window.electronAPI.savePrompt(promptData);
    }

    setShowEditDialog(false);
    loadPrompts();

    // Select the newly created/edited prompt
    const updatedPrompt = await window.electronAPI.getPrompt(promptData.id);
    onSelectPrompt(updatedPrompt);
  };

  const handleDeletePrompt = async (promptId: string) => {
    if (!window.electronAPI) return;
    if (window.confirm('Are you sure you want to delete this prompt?')) {
      await window.electronAPI.deletePrompt(promptId);
      loadPrompts();

      // If the deleted prompt was selected, clear selection
      if (selectedPrompt?.id === promptId) {
        onSelectPrompt(null);
      }
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Prompts</Typography>
          <Stack direction="row" spacing={0.5}>
            <IconButton size="small" onClick={handleNewPrompt} title="New Prompt">
              <AddIcon />
            </IconButton>
            <IconButton size="small" onClick={() => setShowSamplesDialog(true)} title="Load Sample">
              <LoadIcon />
            </IconButton>
          </Stack>
        </Stack>
      </Box>

      <List sx={{ flexGrow: 1, overflow: 'auto', p: 0 }}>
        {prompts.map((prompt) => (
          <ListItem
            key={prompt.id}
            disablePadding
            secondaryAction={
              <Stack direction="row" spacing={0}>
                <IconButton
                  edge="end"
                  size="small"
                  onClick={() => handleEditPrompt(prompt)}
                  disabled={prompt.id === 'default-20-panel'}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton
                  edge="end"
                  size="small"
                  onClick={() => handleDeletePrompt(prompt.id)}
                  disabled={prompt.id === 'default-20-panel'}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            }
          >
            <ListItemButton
              selected={selectedPrompt?.id === prompt.id}
              onClick={() => onSelectPrompt(prompt)}
            >
              <ListItemText
                primary={prompt.title}
                secondary={
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {prompt.content}
                  </Typography>
                }
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      {selectedPrompt && (
        <Paper sx={{ p: 2, m: 2, maxHeight: 300, overflow: 'auto', position: 'relative' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="subtitle1" fontWeight="bold">
              Selected Prompt
            </Typography>
            <IconButton
              size="small"
              onClick={() => handleEditPrompt(selectedPrompt)}
              disabled={selectedPrompt.id === 'default-20-panel'}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', fontSize: '1.1rem' }}>
            {selectedPrompt.content}
          </Typography>
        </Paper>
      )}

      <Dialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingPrompt ? 'Edit Prompt' : 'New Prompt'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Title"
            fullWidth
            variant="outlined"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Prompt Content"
            fullWidth
            multiline
            rows={15}
            variant="outlined"
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            placeholder="Enter your storyboard prompt here..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditDialog(false)}>Cancel</Button>
          <Button
            onClick={handleSavePrompt}
            variant="contained"
            disabled={!formData.title || !formData.content}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sample Storyboards Dialog */}
      <Dialog
        open={showSamplesDialog}
        onClose={() => setShowSamplesDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Load Sample Storyboard</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Load a professionally crafted sample storyboard to see how Qwen-Image-Edit
            maintains character consistency across panels.
          </Typography>
          <List>
            <ListItemButton onClick={handleLoadSamples}>
              <ListItemText
                primary="Character Journey"
                secondary="20 panels • Emotional journey • Requires reference image"
              />
            </ListItemButton>
          </List>
          <Typography variant="caption" color="warning.main" sx={{ mt: 2, display: 'block' }}>
            ⚠️ Sample storyboards require a reference image for character consistency.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSamplesDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}