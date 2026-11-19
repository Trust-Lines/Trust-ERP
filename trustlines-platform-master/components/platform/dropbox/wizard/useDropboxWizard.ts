'use client';

import { useState } from 'react';
import {
  PRODUCTION_DIR, WIZARD_ROOT, createProjectStructure, createSingleFolder, listFolders, savePath, type FolderItem,
} from './wizardApi';

const lastSegment = (path: string) => path.split('/').pop() ?? '';

/**
 * Step state for the folder wizard:
 *   0 region → 1 status → 2 client type → 3 client → 4 project → 5 production type → 6 confirm → 7 saved
 */
export function useDropboxWizard() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [region, setRegion] = useState('');
  const [status, setStatus] = useState('');
  const [clientType, setClientType] = useState('');
  const [clientPath, setClientPath] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [productionType, setProductionType] = useState('');
  const [finalPath, setFinalPath] = useState('');

  const [clients, setClients] = useState<FolderItem[]>([]);
  const [newClientName, setNewClientName] = useState('');

  const [projects, setProjects] = useState<FolderItem[]>([]);
  const [newProjectNo, setNewProjectNo] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectAddr, setNewProjectAddr] = useState('');

  const [savedTo, setSavedTo] = useState('');

  const clearError = () => setError('');

  /** Runs an async step with the shared loading flag and error banner. */
  async function guarded(fn: () => Promise<void>) {
    setLoading(true); clearError();
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Error'); } finally { setLoading(false); }
  }

  function chooseRegion(r: string) { setRegion(r); setStep(1); }
  function chooseStatus(s: string) { setStatus(s); setStep(2); }

  function chooseClientType(value: string) {
    setClientType(value);
    void guarded(async () => {
      setClients(await listFolders(`${WIZARD_ROOT}/${region}/${status}/${value}`));
      setStep(3);
    });
  }

  function selectClient(f: FolderItem) {
    setClientPath(f.path);
    void guarded(async () => {
      setProjects(await listFolders(f.path));
      setStep(4);
    });
  }

  function createClient() {
    if (!newClientName.trim()) return;
    void guarded(async () => {
      const path = `${WIZARD_ROOT}/${region}/${status}/${clientType}/${newClientName.trim()}`;
      await createSingleFolder(path);
      setClientPath(path);
      setProjects([]);
      setStep(4);
    });
  }

  function selectProject(f: FolderItem) {
    setProjectPath(f.path);
    setStep(5);
  }

  const canCreateProject = !!newProjectNo.trim() && !!newProjectName.trim() && !!newProjectAddr.trim();
  function createProject() {
    if (!canCreateProject) return;
    void guarded(async () => {
      const path = `${clientPath}/${newProjectNo.trim()}- ${newProjectName.trim()}, ${newProjectAddr.trim()}`;
      await createProjectStructure(path);
      setProjectPath(path);
      setStep(5);
    });
  }

  function selectProductionType(type: string) {
    setProductionType(type);
    setFinalPath(`${projectPath}/${PRODUCTION_DIR}/${type}`);
    setStep(6);
  }

  function confirmSave() {
    void guarded(async () => {
      setSavedTo(await savePath(finalPath));
      setStep(7);
    });
  }

  function reset() {
    setStep(0); setRegion(''); setStatus(''); setClientType('');
    setClientPath(''); setProjectPath(''); setProductionType('');
    setFinalPath(''); setSavedTo(''); setNewClientName('');
    setNewProjectNo(''); setNewProjectName(''); setNewProjectAddr('');
  }

  const currentPath = [
    WIZARD_ROOT,
    region,
    status,
    clientType,
    clientPath ? lastSegment(clientPath) : '',
    projectPath ? lastSegment(projectPath) : '',
    productionType ? `${PRODUCTION_DIR}/${productionType}` : '',
  ].filter(Boolean).join('/').replace(/\/+/g, '/');

  return {
    step, setStep, loading, error, clearError,
    region, status, clientType, clientName: lastSegment(clientPath), projectName: lastSegment(projectPath),
    finalPath, savedTo, currentPath,
    clients, newClientName, setNewClientName,
    projects, newProjectNo, setNewProjectNo, newProjectName, setNewProjectName, newProjectAddr, setNewProjectAddr, canCreateProject,
    chooseRegion, chooseStatus, chooseClientType, selectClient, createClient, selectProject, createProject,
    selectProductionType, confirmSave, reset,
  };
}
