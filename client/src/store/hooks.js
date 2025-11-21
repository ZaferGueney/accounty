import { useDispatch, useSelector } from 'react-redux';
import { store } from './index';

// Use throughout your app instead of plain `useDispatch` and `useSelector`
// @ts-ignore - dispatch typed for async thunks
export const useAppDispatch = () => useDispatch();
export const useAppSelector = useSelector;