import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Edit, Trash2, Eye, Copy, BookOpen, X } from 'lucide-react';

interface ContentReference {
  id: string;
  title: string;
  content: string;
  description: string;
  grade_level: 'P.1' | 'P.2' | 'P.3' | 'P.4' | 'P.5' | 'P.6';
  category_tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  usage_count: number;
}

const GRADE_LEVELS = ['P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6'] as const;

export const ContentDatabase: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [contents, setContents] = useState<ContentReference[]>([]);
  const [filteredContents, setFilteredContents] = useState<ContentReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGradeLevels, setSelectedGradeLevels] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentReference | null>(null);
  const [editingContent, setEditingContent] = useState<ContentReference | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    description: '',
    grade_level: 'P.1' as const,
    category_tags: '',
  });

  useEffect(() => {
    if (isAdmin) {
      fetchContents();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    filterContents();
  }, [contents, searchQuery, selectedGradeLevels]);

  const fetchContents = async () => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('content_reference')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setContents(data || []);
    } catch (err) {
      console.error('Error fetching contents:', err);
      setError('Failed to load content references');
    } finally {
      setLoading(false);
    }
  };

  const filterContents = () => {
    let filtered = [...contents];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (content) =>
          content.title.toLowerCase().includes(query) ||
          content.content.toLowerCase().includes(query) ||
          content.description.toLowerCase().includes(query)
      );
    }

    if (selectedGradeLevels.length > 0) {
      filtered = filtered.filter((content) =>
        selectedGradeLevels.includes(content.grade_level)
      );
    }

    setFilteredContents(filtered);
  };

  const toggleGradeLevel = (level: string) => {
    setSelectedGradeLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!user?.id) {
      setError('User not authenticated');
      return;
    }

    try {
      const tags = formData.category_tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      if (editingContent) {
        const { error: updateError } = await supabase
          .from('content_reference')
          .update({
            title: formData.title,
            content: formData.content,
            description: formData.description,
            grade_level: formData.grade_level,
            category_tags: tags,
          })
          .eq('id', editingContent.id);

        if (updateError) throw updateError;
        setSuccess('Content updated successfully');
      } else {
        const { error: insertError } = await supabase
          .from('content_reference')
          .insert({
            title: formData.title,
            content: formData.content,
            description: formData.description,
            grade_level: formData.grade_level,
            category_tags: tags,
            created_by: user.id,
          });

        if (insertError) throw insertError;
        setSuccess('Content added successfully');
      }

      setShowAddModal(false);
      setEditingContent(null);
      setFormData({
        title: '',
        content: '',
        description: '',
        grade_level: 'P.1',
        category_tags: '',
      });
      fetchContents();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving content:', err);
      setError('Failed to save content reference');
    }
  };

  const handleEdit = (content: ContentReference) => {
    setEditingContent(content);
    setFormData({
      title: content.title,
      content: content.content,
      description: content.description,
      grade_level: content.grade_level,
      category_tags: content.category_tags.join(', '),
    });
    setShowAddModal(true);
  };

  const handleDuplicate = (content: ContentReference) => {
    setEditingContent(null);
    setFormData({
      title: `${content.title} (Copy)`,
      content: content.content,
      description: content.description,
      grade_level: content.grade_level,
      category_tags: content.category_tags.join(', '),
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('content_reference')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setSuccess('Content deleted successfully');
      fetchContents();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error deleting content:', err);
      setError('Failed to delete content reference');
    }
  };

  const handleView = (content: ContentReference) => {
    setSelectedContent(content);
    setShowViewModal(true);
  };

  const closeModals = () => {
    setShowAddModal(false);
    setShowViewModal(false);
    setEditingContent(null);
    setSelectedContent(null);
    setFormData({
      title: '',
      content: '',
      description: '',
      grade_level: 'P.1',
      category_tags: '',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-slate-600">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Content Reference Database</h1>
            <p className="text-slate-600">
              Manage reference materials for exercise development ({filteredContents.length} of {contents.length} entries)
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition flex items-center space-x-2"
          >
            <Plus size={20} />
            <span>Add Content</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search by title, content, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-700">Grade Level:</span>
            {GRADE_LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => toggleGradeLevel(level)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                  selectedGradeLevels.includes(level)
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {level}
              </button>
            ))}
            {selectedGradeLevels.length > 0 && (
              <button
                onClick={() => setSelectedGradeLevels([])}
                className="px-3 py-1 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {filteredContents.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <BookOpen size={48} className="mx-auto text-slate-400 mb-4" />
            <p className="text-slate-600 text-lg">
              {contents.length === 0
                ? 'No content references yet. Add your first reference to get started.'
                : 'No content matches your search criteria.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContents.map((content) => (
              <div
                key={content.id}
                className="bg-white rounded-xl shadow-lg hover:shadow-xl transition p-6 border border-slate-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-bold text-slate-800 flex-1 line-clamp-2">
                    {content.title}
                  </h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ml-2 ${
                      content.grade_level === 'P.1' || content.grade_level === 'P.2'
                        ? 'bg-blue-100 text-blue-700'
                        : content.grade_level === 'P.3' || content.grade_level === 'P.4'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    {content.grade_level}
                  </span>
                </div>

                <p className="text-slate-600 text-sm mb-3 line-clamp-3">
                  {content.description || 'No description provided'}
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {content.category_tags.slice(0, 3).map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                  {content.category_tags.length > 3 && (
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
                      +{content.category_tags.length - 3} more
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-500 mb-4">
                  Created: {new Date(content.created_at).toLocaleDateString()}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleView(content)}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm font-medium"
                  >
                    <Eye size={16} />
                    <span>View</span>
                  </button>
                  <button
                    onClick={() => handleEdit(content)}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition text-sm font-medium"
                  >
                    <Edit size={16} />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDuplicate(content)}
                    className="p-2 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition"
                    title="Duplicate"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(content.id, content.title)}
                    className="p-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-8 my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-800">
                {editingContent ? 'Edit Content Reference' : 'Add Content Reference'}
              </h2>
              <button
                onClick={closeModals}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                  placeholder="Enter content title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Grade Level <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.grade_level}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      grade_level: e.target.value as typeof formData.grade_level,
                    })
                  }
                  required
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                >
                  {GRADE_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Content <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  required
                  rows={8}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition resize-none"
                  placeholder="Enter the content text"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {formData.content.length} characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition resize-none"
                  placeholder="Brief description for AI categorization and search"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Category Tags
                </label>
                <input
                  type="text"
                  value={formData.category_tags}
                  onChange={(e) => setFormData({ ...formData, category_tags: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                  placeholder="e.g. science, animals, story (comma-separated)"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModals}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-3 px-4 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition"
                >
                  {editingContent ? 'Update Content' : 'Add Content'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && selectedContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl p-8 my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-800">{selectedContent.title}</h2>
              <button
                onClick={closeModals}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X size={24} />
              </button>
            </div>

            <div className="mb-6 flex items-center gap-4">
              <span
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  selectedContent.grade_level === 'P.1' || selectedContent.grade_level === 'P.2'
                    ? 'bg-blue-100 text-blue-700'
                    : selectedContent.grade_level === 'P.3' || selectedContent.grade_level === 'P.4'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-orange-100 text-orange-700'
                }`}
              >
                {selectedContent.grade_level}
              </span>
              {selectedContent.category_tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>

            {selectedContent.description && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Description</h3>
                <p className="text-slate-600">{selectedContent.description}</p>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Content</h3>
              <div className="p-4 bg-slate-50 rounded-lg whitespace-pre-wrap text-slate-800 max-h-96 overflow-y-auto">
                {selectedContent.content}
              </div>
            </div>

            <div className="text-xs text-slate-500 mb-6">
              <p>Created: {new Date(selectedContent.created_at).toLocaleString()}</p>
              <p>Last Updated: {new Date(selectedContent.updated_at).toLocaleString()}</p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  handleEdit(selectedContent);
                  setShowViewModal(false);
                }}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition flex items-center justify-center space-x-2"
              >
                <Edit size={20} />
                <span>Edit</span>
              </button>
              <button
                onClick={closeModals}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-3 px-4 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentDatabase;
